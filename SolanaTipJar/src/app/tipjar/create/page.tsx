'use client'

import { CreateTipJarForm } from '@/components/tipjar/create/create-tip-jar-form'
import { DonationList } from '@/components/tipjar/donation/donation-list'
import { useTipJarProgram } from '@/components/tipjar/tipjar-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@radix-ui/react-dropdown-menu'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export default function Page() {
  const { myTipJar, deleteTipJar, withdraw, transactions } = useTipJarProgram()

  const handleWithdraw = async () => {
    if (!myTipJar?.balance || myTipJar.balance === 0) {
      toast.error('No funds to withdraw')
      return
    }

    try {
      await withdraw.mutateAsync()
      toast.success('Withdraw successful!')
    } catch (err) {
      console.error(err)
      toast.error('Withdraw failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {myTipJar ? (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-4xl font-bold mb-3 text-balance">Your Tip Jar</h1>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Manage your tip jar and track your earnings
                </p>
              </div>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">{myTipJar.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <p className="mt-2 leading-relaxed">{myTipJar.description}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Wallet Address</Label>
                    <div className="mt-2 flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                      <p className="font-mono text-sm flex-1 truncate">{myTipJar.owner.toBase58()}</p>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm text-muted-foreground">Current Balance</Label>
                    <div className="mt-2">
                      <p className="text-4xl font-bold text-balance">{myTipJar.balance?.toFixed(4) || '0.0000'} SOL</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="destructive"
                      onClick={() => deleteTipJar.mutateAsync()}
                      disabled={deleteTipJar.isPending}
                    >
                      {deleteTipJar.isPending ? 'Deleting...' : 'Delete Tip Jar'}
                    </Button>

                    <Button
                      variant="default"
                      onClick={handleWithdraw}
                      disabled={withdraw.isPending || !myTipJar.balance || myTipJar.balance === 0}
                    >
                      {withdraw.isPending ? 'Withdrawing...' : 'Withdraw All'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <DonationList transactions={transactions} />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-3 text-balance">Create Your Tip Jar</h1>
              </div>
              <CreateTipJarForm />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
