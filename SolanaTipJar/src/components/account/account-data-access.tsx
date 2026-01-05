'use client'

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTokenDisplayName } from '@/lib/utils'

export function useGetBalance({ address }: { address: PublicKey | null | undefined }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address: address?.toString() }],
    queryFn: () => {
      if (!address) throw new Error('Address is required')
      return connection.getBalance(address)
    },
    enabled: !!address,
  })
}

export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getSignaturesForAddress(address),
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: (failureCount, error: any) => {
      // Don't retry on 429 (Too Many Requests) errors
      if (error?.message?.includes('429') || error?.status === 429) {
        return false
      }
      // Retry other errors up to 2 times with exponential backoff
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
  })
}

export interface ParsedTransaction {
  signature: string
  slot: number
  blockTime: number | null
  err: any
  type: 'SOL' | 'SPL' | 'unknown'
  amount?: number
  mint?: string
  symbol?: string
  decimals?: number
  from?: string
  to?: string
}

// Helper function to batch requests with delays to avoid rate limits
async function batchRequests<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return results
}

export function useGetParsedTransactions({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  const signaturesQuery = useGetSignatures({ address })

  return useQuery({
    queryKey: ['get-parsed-transactions', { endpoint: connection.rpcEndpoint, address }],
    queryFn: async (): Promise<ParsedTransaction[]> => {
      if (!signaturesQuery.data || signaturesQuery.data.length === 0) return []

      // Fetch parsed transactions (limit to first 50 for performance)
      const signatures = signaturesQuery.data.slice(0, 50)
      
      // Batch requests to avoid rate limits: 10 at a time with 200ms delay between batches
      const transactions = await batchRequests(
        signatures,
        10,
        200,
        (sig) =>
          connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          }),
      )

      const parsed: ParsedTransaction[] = []

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i]
        const sig = signatures[i]

        if (!tx?.meta) continue

        const parsedTx: ParsedTransaction = {
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime ?? null,
          err: sig.err,
          type: 'unknown',
        }

        // Check for SPL token transfers FIRST (before SOL checks)
        // Token transactions often have small SOL balance changes for fees,
        // but the main transaction is the token transfer
        const addressString = address.toString()
        let hasTokenTransfer = false

        if (tx.meta.postTokenBalances && tx.meta.preTokenBalances) {
          // Collect all token accounts that changed
          const tokenAccountChanges: Array<{
            accountKey: PublicKey
            amountChange: number
            mint: string
            decimals: number
          }> = []

          for (const postBalance of tx.meta.postTokenBalances) {
            const preBalance = tx.meta.preTokenBalances.find(
              (pre) => pre.accountIndex === postBalance.accountIndex && pre.mint === postBalance.mint,
            )

            if (preBalance && postBalance) {
              const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0')
              const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0')
              const amountChange = postAmount - preAmount

              if (amountChange !== 0) {
                const accountKeyRaw = tx.transaction.message.accountKeys[postBalance.accountIndex]
                
                // Extract account key properly
                let accountKey: PublicKey | null = null
                if (typeof accountKeyRaw === 'string') {
                  try {
                    accountKey = new PublicKey(accountKeyRaw)
                  } catch {
                    continue
                  }
                } else if (accountKeyRaw instanceof PublicKey) {
                  accountKey = accountKeyRaw
                } else if ('pubkey' in accountKeyRaw && accountKeyRaw.pubkey instanceof PublicKey) {
                  accountKey = accountKeyRaw.pubkey
                } else {
                  continue
                }

                tokenAccountChanges.push({
                  accountKey,
                  amountChange,
                  mint: postBalance.mint,
                  decimals: postBalance.uiTokenAmount.decimals,
                })
              }
            }
          }

          // Check inner instructions for token transfers
          // Collect all token transfers that involve our address's token accounts
          const innerInstructions = tx.meta.innerInstructions || []
          const relevantTransfers: Array<{
            amount: number
            mint: string
            decimals: number
            from: string
            to: string
            isIncoming: boolean
          }> = []

          // Create a map of account keys to their mint and decimals for quick lookup
          const accountInfoMap = new Map<string, { mint: string; decimals: number }>()
          for (const change of tokenAccountChanges) {
            accountInfoMap.set(change.accountKey.toString(), {
              mint: change.mint,
              decimals: change.decimals,
            })
          }
          
          // Also add all token accounts from postTokenBalances to the map
          if (tx.meta.postTokenBalances) {
            for (const postBalance of tx.meta.postTokenBalances) {
              const accountKeyRaw = tx.transaction.message.accountKeys[postBalance.accountIndex]
              let accountKey: PublicKey | null = null
              if (typeof accountKeyRaw === 'string') {
                try {
                  accountKey = new PublicKey(accountKeyRaw)
                } catch {
                  continue
                }
              } else if (accountKeyRaw instanceof PublicKey) {
                accountKey = accountKeyRaw
              } else if ('pubkey' in accountKeyRaw && accountKeyRaw.pubkey instanceof PublicKey) {
                accountKey = accountKeyRaw.pubkey
              } else {
                continue
              }
              
              const accountKeyString = accountKey.toString()
              if (!accountInfoMap.has(accountKeyString)) {
                accountInfoMap.set(accountKeyString, {
                  mint: postBalance.mint,
                  decimals: postBalance.uiTokenAmount.decimals,
                })
              }
            }
          }

          for (const inner of innerInstructions) {
            for (const ix of inner.instructions) {
              if (
                'parsed' in ix &&
                (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
                ix.parsed.type === 'transfer'
              ) {
                const info = ix.parsed.info
                const destination = info.destination
                const source = info.source

                // Check if this transfer involves any of our token accounts
                // A transfer involves us if the source is one of our token accounts (outgoing)
                // or the destination is one of our token accounts (incoming)
                const sourceInfo = accountInfoMap.get(source)
                const destInfo = accountInfoMap.get(destination)
                
                // Check if source is one of our token accounts
                // If source is in tokenAccountChanges with negative change, it's an outgoing transfer from us
                const sourceChange = tokenAccountChanges.find((c) => c.accountKey.toString() === source)
                const isFromUser = sourceChange !== undefined && sourceChange.amountChange < 0
                
                // Check if destination is one of our token accounts
                const destChange = tokenAccountChanges.find((c) => c.accountKey.toString() === destination)
                const isToUser = destChange !== undefined && destChange.amountChange > 0
                
                if (isFromUser || isToUser) {
                  // Get mint and decimals from the account info map
                  // Prefer source info for outgoing, dest info for incoming
                  let accountInfo = isFromUser ? sourceInfo : destInfo
                  
                  // If not found in map, try to get from the change
                  if (!accountInfo) {
                    const change = isFromUser ? sourceChange : destChange
                    if (change) {
                      accountInfo = {
                        mint: change.mint,
                        decimals: change.decimals,
                      }
                      // Also update the map for future lookups
                      accountInfoMap.set(isFromUser ? source : destination, accountInfo)
                    } else {
                      continue
                    }
                  }
                  
                  const { mint, decimals } = accountInfo

                  // Use the actual transfer amount from the instruction
                  let transferAmount: number
                  if (info.tokenAmount) {
                    // Use uiAmount if available (human-readable)
                    transferAmount = parseFloat(info.tokenAmount.uiAmountString || '0')
                  } else if (info.amount) {
                    // Convert from raw amount using decimals
                    const rawAmount = parseFloat(info.amount)
                    transferAmount = rawAmount / Math.pow(10, decimals)
                  } else {
                    // Fallback: try to find from balance changes
                    const sourceChange = tokenAccountChanges.find((c) => c.accountKey.toString() === source)
                    if (sourceChange) {
                      transferAmount = Math.abs(sourceChange.amountChange)
                    } else {
                      continue // Skip if we can't determine amount
                    }
                  }

                  const isIncoming = isToUser && !isFromUser
                  relevantTransfers.push({
                    amount: Math.abs(transferAmount),
                    mint,
                    decimals,
                    from: info.authority || info.source || '',
                    to: info.destination,
                    isIncoming,
                  })
                }
              }
            }
          }

          // If we found relevant transfers, use the largest one (main transfer, not fee)
          // or sum them if they're all in the same direction
          if (relevantTransfers.length > 0) {
            // Group by mint
            const transfersByMint = relevantTransfers.reduce((acc, transfer) => {
              if (!acc[transfer.mint]) {
                acc[transfer.mint] = []
              }
              acc[transfer.mint].push(transfer)
              return acc
            }, {} as Record<string, typeof relevantTransfers>)

            // For each mint, find the main transfer
            for (const mint in transfersByMint) {
              const transfers = transfersByMint[mint]
              // If multiple transfers, use the largest one (main transfer)
              // or sum if they're all in the same direction
              const incoming = transfers.filter((t) => t.isIncoming)
              const outgoing = transfers.filter((t) => !t.isIncoming)
              
              let mainTransfer = transfers[0]
              
              if (incoming.length > 0 && outgoing.length === 0) {
                // All incoming - sum them up to get total received
                const totalAmount = incoming.reduce((sum, t) => sum + t.amount, 0)
                mainTransfer = { ...incoming[0], amount: totalAmount }
              } else if (outgoing.length > 0 && incoming.length === 0) {
                // All outgoing - sum them up to get total sent
                const totalAmount = outgoing.reduce((sum, t) => sum + t.amount, 0)
                mainTransfer = { ...outgoing[0], amount: totalAmount }
              } else {
                // Mixed directions - use the largest transfer as the main one
                mainTransfer = transfers.reduce((max, t) => (t.amount > max.amount ? t : max), transfers[0])
              }

              parsedTx.type = 'SPL'
              parsedTx.amount = mainTransfer.amount
              parsedTx.mint = mainTransfer.mint
              parsedTx.symbol = getTokenDisplayName(mainTransfer.mint, undefined)
              parsedTx.decimals = mainTransfer.decimals
              parsedTx.from = mainTransfer.from
              parsedTx.to = mainTransfer.to
              
              hasTokenTransfer = true
              break // Use first mint found
            }
          }

          // If we still don't have a type but found token balance changes,
          // check if any of the token accounts belong to our address
          // Use the balance change as it represents the net amount sent/received
          if (!hasTokenTransfer && tokenAccountChanges.length > 0) {
            // Batch fetch account info for all token accounts
            const accountInfos = await Promise.all(
              tokenAccountChanges.map((change) =>
                connection.getParsedAccountInfo(change.accountKey).catch(() => null),
              ),
            )
            
            for (let i = 0; i < accountInfos.length; i++) {
              const accountInfo = accountInfos[i]
              const change = tokenAccountChanges[i]

              if (
                accountInfo?.value &&
                'parsed' in accountInfo.value.data &&
                accountInfo.value.data.parsed.info.owner === addressString
              ) {
                // This token account belongs to our address
                if (change.amountChange < 0) {
                  // Balance decreased - we sent tokens
                  // Use the absolute balance change as the transaction amount
                  parsedTx.type = 'SPL'
                  parsedTx.amount = Math.abs(change.amountChange)
                  parsedTx.mint = change.mint
                  parsedTx.symbol = getTokenDisplayName(change.mint, undefined)
                  parsedTx.decimals = change.decimals
                  parsedTx.from = addressString
                  
                  // Try to find recipient from instructions
                  for (const inner of innerInstructions) {
                    for (const ix of inner.instructions) {
                      if (
                        'parsed' in ix &&
                        (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
                        ix.parsed.type === 'transfer' &&
                        ix.parsed.info.source === change.accountKey.toString()
                      ) {
                        parsedTx.to = ix.parsed.info.destination
                        break
                      }
                    }
                  }
                } else {
                  // Balance increased - we received tokens
                  parsedTx.type = 'SPL'
                  parsedTx.amount = Math.abs(change.amountChange)
                  parsedTx.mint = change.mint
                  parsedTx.symbol = getTokenDisplayName(change.mint, undefined)
                  parsedTx.decimals = change.decimals
                  parsedTx.to = addressString
                  
                  // Try to find sender from instructions
                  for (const inner of innerInstructions) {
                    for (const ix of inner.instructions) {
                      if (
                        'parsed' in ix &&
                        (ix.program === 'spl-token' || ix.program === 'spl-token-2022') &&
                        ix.parsed.type === 'transfer' &&
                        ix.parsed.info.destination === change.accountKey.toString()
                      ) {
                        parsedTx.from = ix.parsed.info.authority || ix.parsed.info.source || ''
                        break
                      }
                    }
                  }
                }
                
                hasTokenTransfer = true
                break
              }
            }
          }
        }

        // Only check for SOL transfers if we didn't find a token transfer
        // Token transactions often have small SOL balance changes for fees
        if (!hasTokenTransfer) {
          const mainInstructions = tx.transaction.message.instructions || []
          
          // Check main instructions first
          for (const ix of mainInstructions) {
            if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
              const info = ix.parsed.info
              // Only count as SOL transfer if it's a significant amount (more than just fees)
              // Fees are typically very small (< 0.001 SOL)
              const solAmount = info.lamports / LAMPORTS_PER_SOL
              if ((info.destination === addressString || info.source === addressString) && solAmount > 0.0001) {
                parsedTx.type = 'SOL'
                parsedTx.amount = solAmount
                parsedTx.from = info.source
                parsedTx.to = info.destination
                break
              }
            }
          }

          // Also check inner instructions if not found in main instructions
          if (parsedTx.type === 'unknown') {
            const innerInstructions = tx.meta.innerInstructions || []
            for (const inner of innerInstructions) {
              for (const ix of inner.instructions) {
                if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
                  const info = ix.parsed.info
                  const solAmount = info.lamports / LAMPORTS_PER_SOL
                  if ((info.destination === addressString || info.source === addressString) && solAmount > 0.0001) {
                    parsedTx.type = 'SOL'
                    parsedTx.amount = solAmount
                    parsedTx.from = info.source
                    parsedTx.to = info.destination
                    break
                  }
                }
              }
              if (parsedTx.type === 'SOL') break
            }
          }

          // Check SOL balance changes (for cases where transfer isn't in instructions)
          // Only if no significant SOL transfer was found and no token transfer
          if (parsedTx.type === 'unknown' && tx.meta.preBalances && tx.meta.postBalances) {
            const accountIndex = tx.transaction.message.accountKeys.findIndex((key) => {
              if (typeof key === 'string') {
                return key === addressString
              } else if (key instanceof PublicKey) {
                return key.toString() === addressString
              } else if ('pubkey' in key && key.pubkey instanceof PublicKey) {
                return key.pubkey.toString() === addressString
              }
              return false
            })

            if (accountIndex >= 0 && accountIndex < tx.meta.preBalances.length && accountIndex < tx.meta.postBalances.length) {
              const preBalance = tx.meta.preBalances[accountIndex]
              const postBalance = tx.meta.postBalances[accountIndex]
              const balanceChange = postBalance - preBalance
              const solAmount = Math.abs(balanceChange) / LAMPORTS_PER_SOL

              // Only mark as SOL if it's a significant change (more than just fees)
              if (balanceChange !== 0 && solAmount > 0.0001) {
                parsedTx.type = 'SOL'
                parsedTx.amount = solAmount
                // Try to find source/destination from instructions
                for (const ix of mainInstructions) {
                  if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
                    const info = ix.parsed.info
                    if (info.destination === addressString) {
                      parsedTx.from = info.source
                      parsedTx.to = info.destination
                      break
                    } else if (info.source === addressString) {
                      parsedTx.from = info.source
                      parsedTx.to = info.destination
                      break
                    }
                  }
                }
              }
            }
          }
        }

        parsed.push(parsedTx)
      }

      return parsed
    },
    enabled: !!signaturesQuery.data && signaturesQuery.data.length > 0,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    retry: (failureCount, error: any) => {
      // Don't retry on 429 (Too Many Requests) errors
      if (error?.message?.includes('429') || error?.status === 429) {
        return false
      }
      // Retry other errors up to 2 times with exponential backoff
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
  })
}

export function useGetTokenAccounts({ address }: { address: PublicKey | null | undefined }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-token-accounts', { endpoint: connection.rpcEndpoint, address: address?.toString() }],
    queryFn: async () => {
      if (!address) throw new Error('Address is required')
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ])
      return [...tokenAccounts.value, ...token2022Accounts.value]
    },
    enabled: !!address,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: (failureCount, error: any) => {
      // Don't retry on 429 (Too Many Requests) errors
      if (error?.message?.includes('429') || error?.status === 429) {
        return false
      }
      // Retry other errors up to 2 times with exponential backoff
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
  })
}

export function useTransferSol({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  // const transactionToast = useTransactionToast()
  const wallet = useWallet()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['transfer-sol', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      let signature: TransactionSignature = ''
      try {
        const { transaction, latestBlockhash } = await createTransaction({
          publicKey: address,
          destination: input.destination,
          amount: input.amount,
          connection,
        })

        // Send transaction and await for signature
        signature = await wallet.sendTransaction(transaction, connection)

        // Send transaction and await for signature
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')

        console.log(signature)
        return signature
      } catch (error: unknown) {
        console.log('error', `Transaction failed! ${error}`, signature)

        return
      }
    },
    onSuccess: async (signature) => {
      if (signature) {
        // TODO: Add back Toast
        // transactionToast(signature)
        console.log('Transaction sent', signature)
      }
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
    onError: (error) => {
      // TODO: Add Toast
      console.error(`Transaction failed! ${error}`)
    },
  })
}

export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  // const transactionToast = useTransactionToast()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['airdrop', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (amount: number = 1) => {
      const [latestBlockhash, signature] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
      ])

      await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
      return signature
    },
    onSuccess: async (signature) => {
      // TODO: Add back Toast
      // transactionToast(signature)
      console.log('Airdrop sent', signature)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
  })
}

async function createTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey
  destination: PublicKey
  amount: number
  connection: Connection
}): Promise<{
  transaction: VersionedTransaction
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number }
}> {
  // Get the latest blockhash to use in our transaction
  const latestBlockhash = await connection.getLatestBlockhash()

  // Create instructions to send, in this case a simple transfer
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  ]

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage()

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy)

  return {
    transaction,
    latestBlockhash,
  }
}
