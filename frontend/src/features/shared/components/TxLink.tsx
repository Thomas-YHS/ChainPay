interface TxLinkProps {
  hash: string
  chainId?: number
}

function explorerUrl(hash: string, chainId = 8453): string {
  const explorers: Record<number, string> = {
    8453: 'https://basescan.org/tx/',
    42161: 'https://arbiscan.io/tx/',
    100: 'https://gnosisscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
  }
  return `${explorers[chainId] ?? explorers[8453]}${hash}`
}

export default function TxLink({ hash, chainId }: TxLinkProps) {
  const short = `${hash.slice(0, 6)}...${hash.slice(-4)}`
  return (
    <a
      href={explorerUrl(hash, chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="cp-text-code text-status-info transition-colors duration-normal ease-standard hover:text-brand-primary"
    >
      {short} ↗
    </a>
  )
}
