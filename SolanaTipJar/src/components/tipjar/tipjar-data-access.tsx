'use client'

import { getTipJarProgram, getTipJarProgramId } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { utils } from '@coral-xyz/anchor'

function getDiscriminator(accountName: string) {
  const hash = utils.sha256.hash(accountName) // browser-safe
  return Buffer.from(hash.slice(0, 8))
}

export const LAMPORTS_PER_SOL = 1_000_000_000

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
    queryKey: ['tipJars', 'all', cluster],
    queryFn: async () => {
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
  }
}
