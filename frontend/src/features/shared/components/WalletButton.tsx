import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function WalletButton() {
  return (
    <ConnectButton
      showBalance={true}
      chainStatus="none"
      accountStatus="address"
    />
  )
}
