import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowDownLeft, ExternalLink } from 'lucide-react'
import { DonationTransaction } from '../tipjar-data-access'
import { getTokenDisplayName } from '@/lib/utils'

export function DonationList({ transactions }: { transactions: DonationTransaction[] }) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownLeft className="h-5 w-5" />
          Recent Donations
        </CardTitle>
        <CardDescription>
          {transactions.length > 0
            ? `${transactions.length} transaction${transactions.length > 1 ? 's' : ''}`
            : 'No donations received yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.signature}
                className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {tx.amount.toFixed(tx.decimals || 4)}{' '}
                      {tx.tokenType === 'SOL'
                        ? 'SOL'
                        : tx.mint
                          ? getTokenDisplayName(tx.mint, tx.symbol)
                          : tx.symbol || 'Token'}
                    </p>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                      Fee: {tx.fee.toFixed(tx.decimals || 6)}{' '}
                      {tx.tokenType === 'SOL'
                        ? 'SOL'
                        : tx.mint
                          ? getTokenDisplayName(tx.mint, tx.symbol)
                          : tx.symbol || 'Token'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono truncate">From: {tx.donor}</p>
                  {tx.mint && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      Mint: {tx.mint.slice(0, 8)}...{tx.mint.slice(-8)}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {tx.timestamp && <span>{new Date(tx.timestamp * 1000).toLocaleString()}</span>}
                    <span>Slot: {tx.slot}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                  <a href={`https://explorer.solana.com/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="rounded-full bg-muted w-16 h-16 mx-auto flex items-center justify-center mb-4">
              <ArrowDownLeft className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground leading-relaxed">
              No donations yet. Share your tip jar to start receiving support!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
