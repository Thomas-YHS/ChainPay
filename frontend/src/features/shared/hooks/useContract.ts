import { useWriteContract } from 'wagmi'
import { CHAIN_PAY_CONTRACT } from '../../../theme'

// Minimal ABI — only setRules is called from the frontend
const CHAIN_PAY_ABI = [
  {
    name: 'setRules',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'rules',
        type: 'tuple[]',
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'basisPoints', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
  },
] as const

export function useContract() {
  const { writeContractAsync } = useWriteContract()

  function setRules(rules: { chainId: bigint; tokenAddress: `0x${string}`; basisPoints: bigint }[]) {
    return writeContractAsync({
      address: CHAIN_PAY_CONTRACT,
      abi: CHAIN_PAY_ABI,
      functionName: 'setRules',
      args: [rules],
    })
  }

  return { setRules }
}
