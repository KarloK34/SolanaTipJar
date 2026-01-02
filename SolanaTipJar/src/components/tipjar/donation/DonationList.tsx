export function DonationList() {
  ;<Card className="border-2">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ArrowDownLeft className="h-5 w-5" />
        Recent Donations
      </CardTitle>
      <CardDescription>
        {existingTipJar.transactions && existingTipJar.transactions.length > 0
          ? `${existingTipJar.transactions.length} transaction${existingTipJar.transactions.length > 1 ? 's' : ''}`
          : 'No donations received yet'}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {existingTipJar.transactions && existingTipJar.transactions.length > 0 ? (
        <div className="space-y-3">
          {existingTipJar.transactions.map((tx) => (
            <div
              key={tx.signature}
              className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tx.amount.toFixed(4)} SOL</p>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                    Fee: {tx.fee.toFixed(6)} SOL
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-mono truncate">From: {tx.donor}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {tx.timestamp && <span>{new Date(tx.timestamp).toLocaleString()}</span>}
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
}
