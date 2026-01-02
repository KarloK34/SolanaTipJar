'use client'

import { getTipJarProgram, getTipJarProgramId } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { Address, BN, utils } from '@coral-xyz/anchor'

function getDiscriminator(accountName: string) {
  const hash = utils.sha256.hash(accountName) // browser-safe
  return Buffer.from(hash.slice(0, 8))
}

export interface DonationTransaction {
  signature: string
  timestamp: number | null
  donor: string
  amount: number // in SOL
  fee: number // in SOL
  slot: number
}

export function useTipJarProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const queryClient = useQueryClient()

  // Program and Program ID
  const programId = useMemo(() => getTipJarProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getTipJarProgram(provider, programId), [provider, programId])

  const tipJarPda = useMemo(() => {
    if (!wallet?.publicKey) return null
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from('tipjar'), wallet.publicKey.toBuffer()], programId)
    return pda
  }, [wallet?.publicKey, programId])

  const transactionsQuery = useQuery({
    queryKey: ['tipjar', 'transactions', tipJarPda?.toString()],
    queryFn: async (): Promise<DonationTransaction[]> => {
      if (!tipJarPda) return []

      try {
        // Get all signatures for the tip jar account
        const signatures = await connection.getSignaturesForAddress(tipJarPda, {
          limit: 1000, // Adjust as needed
        })

        // Fetch all transactions in parallel
        const transactions = await Promise.all(
          signatures.map((sig) =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            }),
          ),
        )

        // Filter and parse donation transactions
        const donations: DonationTransaction[] = []

        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          const sig = signatures[i]

          if (!tx?.meta || tx.meta.err) continue

          // Look for the donate instruction
          const donateInstruction = tx.transaction.message.instructions.find((ix) => {
            if ('programId' in ix) {
              return ix.programId.equals(programId)
            }
            return false
          })

          if (!donateInstruction) continue

          // Parse the instruction to identify if it's a donate call
          const innerInstructions = tx.meta.innerInstructions || []

          // Look for system program transfers in inner instructions
          let totalTransferred = 0
          let donor = ''

          for (const inner of innerInstructions) {
            for (const ix of inner.instructions) {
              if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
                const info = ix.parsed.info

                // Check if this transfer is TO the tip jar
                if (info.destination === tipJarPda.toString()) {
                  totalTransferred += info.lamports
                  donor = info.source
                }
              }
            }
          }

          // If we found a transfer to the tip jar, it's a donation
          if (totalTransferred > 0 && donor) {
            // Calculate original amount (before 10% fee was taken)
            const tipAmount = totalTransferred / LAMPORTS_PER_SOL
            const originalAmount = tipAmount / 0.9 // Reverse the 90% calculation
            const feeAmount = originalAmount * 0.1

            donations.push({
              signature: sig.signature,
              timestamp: tx.blockTime ?? null,
              donor,
              amount: originalAmount,
              fee: feeAmount,
              slot: sig.slot,
            })
          }
        }

        // Sort by timestamp (most recent first)
        return donations.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return []
      }
    },
    enabled: !!tipJarPda,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Fetch the current user's TipJar account
  const myTipJarQuery = useQuery({
    queryKey: ['tipJar', wallet?.publicKey?.toString()],
    queryFn: async () => {
      try {
        if (!wallet?.publicKey) return null

        const [tipJarPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('tipjar'), wallet.publicKey.toBuffer()],
          programId,
        )
        const tipJar = await program.account.tipJar.fetch(tipJarPda)
        const balance = await connection.getBalance(tipJarPda)
        return { ...tipJar, balance: balance / LAMPORTS_PER_SOL }
      } catch (error) {
        return null
      }
    },
    enabled: !!wallet?.publicKey,
  })

  const otherTipJarsQuery = useQuery({
    queryKey: ['tipJars', 'all', wallet?.publicKey?.toString()],
    queryFn: async () => {
      if (!wallet?.publicKey) return []
      const accounts = await program.account.tipJar.all()
      return accounts.map((acc) => ({
        publicKey: acc.publicKey,
        account: acc.account,
      }))
    },
    enabled: !!program,
  })

  // Create TipJar mutation
  const createTipJar = useMutation({
    mutationKey: ['tipjar', 'create_tip_jar', { cluster }],
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
      if (!title || !description) throw new Error('Title and description must not be empty')

      const user = wallet.publicKey

      return program.methods
        .createTipJar(title, description)
        .accounts({
          user,
        })
        .rpc()
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      myTipJarQuery.refetch()
    },
    onError: (error: any) => {
      console.error(error)
      toast.error('Error creating tip jar')
    },
  })

  const deleteTipJar = useMutation({
    mutationKey: ['tipjar', 'delete', { cluster }],
    mutationFn: async () => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')

      return program.methods.delete().accounts({ user: wallet.publicKey }).rpc()
    },
    onSuccess: (signature: any) => {
      transactionToast(signature)
      myTipJarQuery.refetch()
    },
    onError: (error: any) => {
      console.error(error)
      toast.error(error)
    },
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const donate = useMutation({
    mutationKey: ['tipjar', 'donate', { cluster }, wallet?.publicKey?.toString()],
    mutationFn: async ({ tipjarAddress, amount }: { tipjarAddress: PublicKey; amount: number }) => {
      if (!wallet.publicKey) throw new Error('Wallet not connected')

      const donorPubkey = wallet.publicKey

      return program.methods
        .donate(new BN(amount * LAMPORTS_PER_SOL))
        .accounts({
          donor: donorPubkey,
          tipJar: tipjarAddress,
          feeAccount: new PublicKey('GgbVs9nBVxwNKFK6ipf64fV5ALcbAkd3asCM7dcbpYPd'),
        })
        .rpc()
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      otherTipJarsQuery.refetch()
    },
    onError: (error: any) => {
      console.error(error)
      toast.error('Error donating to tip jar')
    },
  })

  return {
    program,
    programId,
    getProgramAccount,
    createTipJar,
    deleteTipJar,
    myTipJar: myTipJarQuery.data,
    myTipJarLoading: myTipJarQuery.isLoading,
    refetchMyTipJar: myTipJarQuery.refetch,
    otherTipJars: otherTipJarsQuery.data || [],
    otherTipJarsLoading: otherTipJarsQuery.isLoading,
    otherTipJarsError: otherTipJarsQuery.error,
    donate,
    transactions: transactionsQuery.data || [],
    transactionsLoading: transactionsQuery.isLoading,
  }
}
