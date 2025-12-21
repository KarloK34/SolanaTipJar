'use client'

import type React from 'react'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { CustomWalletButton } from '@/components/solana/custom-wallet-button'
import { useTipJarProgram } from '../tipjar-data-access'

export function CreateTipJarForm() {
  const wallet = useWallet()
  const { createTipJar } = useTipJarProgram()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!wallet.connected) {
      toast.warning('Wallet Required')
      return
    }

    createTipJar.mutateAsync({ title: name, description: description })

    // Reset form
    setName('')
    setDescription('')
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Tip Jar Details</CardTitle>
        <CardDescription>Provide information about your tip jar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Your name or brand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Tell supporters what you create..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-3">
            <Label>Wallet Connection *</Label>
            {!wallet.connected ? (
              <CustomWalletButton />
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-secondary bg-secondary/10">
                <div className="flex-shrink-0">
                  <div className="rounded-full bg-secondary p-2">
                    <Check className="h-5 w-5 text-secondary-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Wallet Connected</p>
                  <p className="text-sm text-muted-foreground font-mono truncate">{wallet.publicKey!!.toString()}</p>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={createTipJar.isPending}>
            Create Tip Jar{createTipJar.isPending && '...'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
