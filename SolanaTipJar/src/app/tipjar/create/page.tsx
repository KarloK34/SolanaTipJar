'use client'

import { CreateTipJarForm } from '@/components/tipjar/create/create-tip-jar-form'
import { useTipJarProgram } from '@/components/tipjar/tipjar-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@radix-ui/react-dropdown-menu'
import { ExternalLink } from 'lucide-react'

export default function Page() {
  const { myTipJar, deleteTipJar } = useTipJarProgram()
  console.log(myTipJar)
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
                  <Button
                    variant={'destructive'}
                    onClick={() => {
                      deleteTipJar.mutateAsync()
                    }}
                  >
                    {deleteTipJar.isPending ? 'Deleting...' : 'Delete Tip Jar'}
                  </Button>
                </CardContent>
              </Card>
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
