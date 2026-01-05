'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useCluster } from '../cluster/cluster-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import {
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useGetParsedTransactions,
  useRequestAirdrop,
  useTransferSol,
} from './account-data-access'
import { ellipsify, getTokenDisplayName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AppAlert } from '@/components/app-alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppModal } from '@/components/app-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountBalance({ address }: { address: PublicKey }) {
  const query = useGetBalance({ address })
  const tokenAccountsQuery = useGetTokenAccounts({ address })

  const totalTokenValue = useMemo(() => {
    if (!tokenAccountsQuery.data) return null
    return tokenAccountsQuery.data.length
  }, [tokenAccountsQuery.data])

  return (
    <div className="space-y-2">
      <h1 className="text-5xl font-bold cursor-pointer" onClick={() => query.refetch()}>
        {query.data ? <BalanceSol balance={query.data} /> : '...'} SOL
      </h1>
      {totalTokenValue !== null && totalTokenValue > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalTokenValue} SPL token{totalTokenValue !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  )
}

export function AccountChecker() {
  const { publicKey } = useWallet()
  if (!publicKey) {
    return null
  }
  return <AccountBalanceCheck address={publicKey} />
}

export function AccountBalanceCheck({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  const mutation = useRequestAirdrop({ address })
  const query = useGetBalance({ address })

  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <AppAlert
        action={
          <Button variant="outline" onClick={() => mutation.mutateAsync(1).catch((err) => console.log(err))}>
            Request Airdrop
          </Button>
        }
      >
        You are connected to <strong>{cluster.name}</strong> but your account is not found on this cluster.
      </AppAlert>
    )
  }
  return null
}

export function AccountButtons({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  return (
    <div>
      <div className="space-x-2">
        {cluster.network?.includes('mainnet') ? null : <ModalAirdrop address={address} />}
        <ModalSend address={address} />
        <ModalReceive address={address} />
      </div>
    </div>
  )
}

export function AccountTokens({ address }: { address: PublicKey }) {
  const [showAll, setShowAll] = useState(false)
  const query = useGetTokenAccounts({ address })
  const client = useQueryClient()
  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <div className="space-y-2">
      <div className="justify-between">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Token Accounts</h2>
          <div className="space-x-2">
            {query.isLoading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              <Button
                variant="outline"
                onClick={async () => {
                  await query.refetch()
                  await client.invalidateQueries({
                    queryKey: ['getTokenAccountBalance'],
                  })
                }}
              >
                <RefreshCw size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
      {query.isError && <pre className="alert alert-error">Error: {query.error?.message.toString()}</pre>}
      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div>No token accounts found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Public Key</TableHead>
                  <TableHead>Mint</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map(({ account, pubkey }) => (
                  <TableRow key={pubkey.toString()}>
                    <TableCell>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink label={ellipsify(pubkey.toString())} path={`account/${pubkey.toString()}`} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <span className="font-mono">
                          <ExplorerLink
                            label={ellipsify(account.data.parsed.info.mint)}
                            path={`account/${account.data.parsed.info.mint.toString()}`}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono">{account.data.parsed.info.tokenAmount.uiAmount}</span>
                    </TableCell>
                  </TableRow>
                ))}

                {(query.data?.length ?? 0) > 5 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

export function AccountTransactions({ address }: { address: PublicKey }) {
  const query = useGetSignatures({ address })
  const parsedQuery = useGetParsedTransactions({ address })
  const [showAll, setShowAll] = useState(false)

  const items = useMemo(() => {
    // Prefer parsed transactions if available, otherwise fall back to signatures
    const data = parsedQuery.data || query.data
    if (!data) return []
    if (showAll) return data
    return data.slice(0, 5)
  }, [parsedQuery.data, query.data, showAll])

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="space-x-2">
          {(query.isLoading || parsedQuery.isLoading) ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                query.refetch()
                parsedQuery.refetch()
              }}
            >
              <RefreshCw size={16} />
            </Button>
          )}
        </div>
      </div>
      {(query.isError || parsedQuery.isError) && (
        <pre className="alert alert-error">
          Error: {(query.error || parsedQuery.error)?.message?.toString()}
        </pre>
      )}
      {(query.isSuccess || parsedQuery.isSuccess) && (
        <div>
          {(!items || items.length === 0) ? (
            <div>No transactions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signature</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Slot</TableHead>
                  <TableHead>Block Time</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => {
                  // If we have parsed data, use it; otherwise use signature data
                  const parsedItem = parsedQuery.data?.find((p) => p.signature === item.signature)
                  const isParsed = 'type' in item
                  const displayItem = parsedItem || item

                  return (
                    <TableRow key={displayItem.signature}>
                      <TableCell className="font-mono">
                        <ExplorerLink
                          path={`tx/${displayItem.signature}`}
                          label={ellipsify(displayItem.signature, 8)}
                        />
                      </TableCell>
                      <TableCell>
                        {displayItem.type === 'SPL' ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {displayItem.mint
                              ? getTokenDisplayName(displayItem.mint, displayItem.symbol)
                              : displayItem.symbol || 'SPL Token'}
                          </span>
                        ) : displayItem.type === 'SOL' ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            SOL
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {displayItem.amount !== undefined ? (
                          <span className="font-medium">
                            {displayItem.amount.toFixed(displayItem.decimals || 4)}{' '}
                            {displayItem.type === 'SOL'
                              ? 'SOL'
                              : displayItem.mint
                                ? getTokenDisplayName(displayItem.mint, displayItem.symbol)
                                : displayItem.symbol || ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-right">
                        <ExplorerLink path={`block/${displayItem.slot}`} label={displayItem.slot.toString()} />
                      </TableCell>
                      <TableCell>
                        {displayItem.blockTime
                          ? new Date(displayItem.blockTime * 1000).toLocaleString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {displayItem.err ? (
                          <span className="text-red-500" title={displayItem.err?.toString() || 'Failed'}>
                            Failed
                          </span>
                        ) : (
                          <span className="text-green-500">Success</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {(parsedQuery.data || query.data || [])?.length > 5 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                        {showAll ? 'Show Less' : 'Show All'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}

function BalanceSol({ balance }: { balance: number }) {
  return <span>{Math.round((balance / LAMPORTS_PER_SOL) * 100000) / 100000}</span>
}

function ModalReceive({ address }: { address: PublicKey }) {
  return (
    <AppModal title="Receive">
      <p>Receive assets by sending them to your public key:</p>
      <code>{address.toString()}</code>
    </AppModal>
  )
}

function ModalAirdrop({ address }: { address: PublicKey }) {
  const mutation = useRequestAirdrop({ address })
  const [amount, setAmount] = useState('2')

  return (
    <AppModal
      title="Airdrop"
      submitDisabled={!amount || mutation.isPending}
      submitLabel="Request Airdrop"
      submit={() => mutation.mutateAsync(parseFloat(amount))}
    >
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}

function ModalSend({ address }: { address: PublicKey }) {
  const wallet = useWallet()
  const mutation = useTransferSol({ address })
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('1')

  if (!address || !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }

  return (
    <AppModal
      title="Send"
      submitDisabled={!destination || !amount || mutation.isPending}
      submitLabel="Send"
      submit={() => {
        mutation.mutateAsync({
          destination: new PublicKey(destination),
          amount: parseFloat(amount),
        })
      }}
    >
      <Label htmlFor="destination">Destination</Label>
      <Input
        disabled={mutation.isPending}
        id="destination"
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination"
        type="text"
        value={destination}
      />
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}
