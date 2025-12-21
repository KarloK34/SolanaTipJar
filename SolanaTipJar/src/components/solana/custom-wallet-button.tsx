import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Wallet } from 'lucide-react' // or your icon library
import { Button } from '@/components/ui/button' // adjust import to your Button component
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog' // adjust to your dialog component

export function CustomWalletButton() {
  const { connect, disconnect, connected, publicKey, wallet, wallets, select } = useWallet()
  const [showWalletModal, setShowWalletModal] = useState(false)

  const handleClick = async () => {
    if (connected) {
      await disconnect()
    } else {
      if (!wallet) {
        setShowWalletModal(true)
      } else {
        try {
          await connect()
        } catch (error) {
          console.error('Failed to connect wallet:', error)
        }
      }
    }
  }

  const handleSelectWallet = async (walletName: any) => {
    select(walletName)
    setShowWalletModal(false)
  }

  const displayText = connected
    ? `Disconnect ${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}`
    : 'Connect Solana Wallet'

  return (
    <>
      <Button type="button" onClick={handleClick} className="w-full" size="lg">
        <Wallet className="mr-2 h-5 w-5" />
        {displayText}
      </Button>

      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Wallet</DialogTitle>
            <DialogDescription>Choose a wallet to connect to Solana</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {wallets.map((w) => (
              <Button
                key={w.adapter.name}
                onClick={() => handleSelectWallet(w.adapter.name)}
                variant="outline"
                className="w-full justify-start"
              >
                {w.adapter.icon && <img src={w.adapter.icon} alt={w.adapter.name} className="mr-2 h-5 w-5" />}
                {w.adapter.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
