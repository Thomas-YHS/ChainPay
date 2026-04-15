import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const ready = mounted
        const connected = ready && account && chain

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="min-w-touch rounded-lg border border-brand-primary bg-brand-primary px-5 py-2 text-button-sm font-light text-text-inverse shadow-sm transition-colors duration-normal ease-standard hover:bg-brand-hover"
            >
              连接钱包
            </button>
          )
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="min-w-touch rounded-lg border border-status-error/40 bg-status-error/10 px-4 py-2 text-button-sm font-medium text-status-error"
            >
              切换网络
            </button>
          )
        }

        const shortAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className="min-w-touch rounded-lg border border-border-interactive bg-surface-card px-3 py-2 text-caption font-medium text-text-secondary shadow-sm transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
            >
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className="min-w-touch rounded-lg border border-border-interactive bg-surface-card px-4 py-2 text-button-sm font-light text-text-primary shadow-sm transition-colors duration-normal ease-standard hover:border-border-interactive-strong"
            >
              {shortAddress}
            </button>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
