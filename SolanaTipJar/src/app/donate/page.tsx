'use client'

import { useGetBalance } from '@/components/account/account-data-access'
import { WalletButton } from '@/components/solana/solana-provider'
import { useTipJarProgram } from '@/components/tipjar/tipjar-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { Coins, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type TipJar = {
  publicKey: PublicKey
  account: {
    owner: PublicKey
    name: string
    description: string
    createdAt: BN
    bump: number
  }
}

export function formatTimestamp(timestamp: BN | number): string {
  const seconds = typeof timestamp === 'number' ? timestamp : timestamp.toNumber()
  const date = new Date(seconds * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function Page() {
  const { publicKey } = useWallet()
  if (!publicKey) {
    return (
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    )
  }
  const [availableBalance, setAvailableBalance] = useState({
    SOL: 0,
  })
  const balanceQuery = useGetBalance({ address: publicKey })
  const balance = balanceQuery.data ? balanceQuery.data / LAMPORTS_PER_SOL : 0

  useEffect(() => {
    if (balanceQuery.data) {
      setAvailableBalance({
        SOL: balance,
      })
    }
  }, [balance])

  const { otherTipJars, otherTipJarsLoading } = useTipJarProgram()

  const [selectedJar, setSelectedJar] = useState<TipJar | null>(null)
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('SOL')

  const { donate } = useTipJarProgram()

  const handleDonate = async (jarAddress: PublicKey) => {
    const donateAmount = Number.parseFloat(amount)
    if (!donateAmount || donateAmount <= 0 || donateAmount > balance - 0.05) {
      toast('Invalid Amount', {
        description: 'Please enter a valid donation amount.',
      })
      return
    }

    console.log(jarAddress)
    console.log(donateAmount)

    await donate.mutateAsync({ tipjarAddress: jarAddress, amount: donateAmount })

    // toast('Donation Sent!', {
    //   description: `Successfully sent ${amount} ${token} to ${selectedJar?.account.name}`,
    // })

    setAmount('')
    setSelectedJar(null)
  }

  if (otherTipJarsLoading) {
    return <div>Loading tipjars...</div>
  }

  if (otherTipJars.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No tip jars created yet. Be the first!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {otherTipJars.map((jar) => (
        <Card key={jar.publicKey.toString()} className="flex flex-col hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                {formatTimestamp(jar.account.createdAt)}
              </span>
            </div>
            <CardTitle className="text-xl">{jar.account.name}</CardTitle>
            <CardDescription className="line-clamp-2 leading-relaxed">{jar.account.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
              <p className="text-xs font-mono truncate">{jar.publicKey.toBase58()}</p>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={() => setSelectedJar(jar)}>
                  <Coins className="mr-2 h-4 w-4" />
                  Send Tip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send a Tip to {jar.account.name}</DialogTitle>
                  <DialogDescription>Choose the amount and token you'd like to donate</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Available Balance</span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {availableBalance[token as keyof typeof availableBalance].toFixed(4)} {token}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.25"
                      min="0"
                      max={balance}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="token">Token</Label>
                    <select
                      id="token"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    >
                      {Object.keys(availableBalance).map((coin) => {
                        return <option value={coin}>{coin}</option>
                      })}
                    </select>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Recipient Wallet</p>
                    <p className="text-xs font-mono break-all">{jar.publicKey.toBase58()}</p>
                  </div>

                  <Button onClick={() => handleDonate(jar.publicKey)} className="w-full" size="lg">
                    <Coins className="mr-2 h-5 w-5" />
                    Send {amount || '0'} {token}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
