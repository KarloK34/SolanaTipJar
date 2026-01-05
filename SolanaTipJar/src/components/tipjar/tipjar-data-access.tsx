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
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'

function getDiscriminator(accountName: string) {
  const hash = utils.sha256.hash(accountName) // browser-safe
  return Buffer.from(hash.slice(0, 8))
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

  const donateToken = useMutation({
    mutationKey: ['tipjar', 'donateToken', { cluster }, wallet?.publicKey?.toString()],
    mutationFn: async ({
      tipjarAddress,
      tipJarOwner,
      mint,
      amount,
    }: {
      tipjarAddress: PublicKey
      tipJarOwner: PublicKey
      mint: PublicKey
      amount: number
    }) => {
      if (!wallet.publicKey || !wallet.sendTransaction) throw new Error('Wallet not connected')

      const donorPubkey = wallet.publicKey
      const feeAccount = new PublicKey('GgbVs9nBVxwNKFK6ipf64fV5ALcbAkd3asCM7dcbpYPd')

      // Get ATAs - use tip jar owner (not the PDA) for the ATA owner
      const [donorTokenAccount, feeTokenAccount, tipJarTokenAccount] = await Promise.all([
        getAssociatedTokenAddress(mint, donorPubkey, false, TOKEN_PROGRAM_ID),
        getAssociatedTokenAddress(mint, feeAccount, false, TOKEN_PROGRAM_ID),
        getAssociatedTokenAddress(mint, tipJarOwner, false, TOKEN_PROGRAM_ID),
      ])

      // Check if ATAs exist, create if needed
      const [donorAccountInfo, feeAccountInfo, tipJarAccountInfo] = await Promise.all([
        connection.getAccountInfo(donorTokenAccount),
        connection.getAccountInfo(feeTokenAccount),
        connection.getAccountInfo(tipJarTokenAccount),
      ])

      // Create ATAs if they don't exist
      const { Transaction } = await import('@solana/web3.js')
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token')

      if (!donorAccountInfo) {
        throw new Error('Donor token account does not exist. Please receive some tokens first.')
      }

      const ataTransaction = new Transaction()
      let needsAtaCreation = false

      if (!feeAccountInfo) {
        ataTransaction.add(
          createAssociatedTokenAccountInstruction(
            donorPubkey,
            feeTokenAccount,
            feeAccount,
            mint,
            TOKEN_PROGRAM_ID,
          ),
        )
        needsAtaCreation = true
      }

      if (!tipJarAccountInfo) {
        ataTransaction.add(
          createAssociatedTokenAccountInstruction(
            donorPubkey,
            tipJarTokenAccount,
            tipJarOwner,
            mint,
            TOKEN_PROGRAM_ID,
          ),
        )
        needsAtaCreation = true
      }

      // Send ATA creation transaction if needed
      if (needsAtaCreation) {
        const latestBlockhash = await connection.getLatestBlockhash()
        ataTransaction.recentBlockhash = latestBlockhash.blockhash
        ataTransaction.feePayer = donorPubkey

        const ataSignature = await wallet.sendTransaction(ataTransaction, connection)
        await connection.confirmTransaction({ signature: ataSignature, ...latestBlockhash }, 'confirmed')
      }

      // Convert amount to BN
      const tokenAmount = new BN(amount)

      return program.methods
        .donateToken(tokenAmount)
        .accounts({
          donor: donorPubkey,
          tipJar: tipjarAddress,
          mint: mint,
          donorTokenAccount: donorTokenAccount,
          feeTokenAccount: feeTokenAccount,
          tipJarTokenAccount: tipJarTokenAccount,
        })
        .rpc()
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      otherTipJarsQuery.refetch()
    },
    onError: (error: any) => {
      console.error(error)
      toast.error('Error donating tokens to tip jar')
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
    donateToken,
  }
}
