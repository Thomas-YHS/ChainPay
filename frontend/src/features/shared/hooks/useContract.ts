import { useWriteContract, useReadContract } from 'wagmi'
import { CHAIN_PAY_CONTRACT, USDC_BASE } from '../../../theme'

// Minimal ABI — only the functions we call
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
  {
    name: 'getRules',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'employee', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'basisPoints', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'executePayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'employer', type: 'address' },
      { name: 'employee', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'lifiCallData', type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const

const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
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

  function approveUsdc(amount: bigint) {
    return writeContractAsync({
      address: USDC_BASE as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [CHAIN_PAY_CONTRACT, amount],
    })
  }

  function executePayout(
    employer: `0x${string}`,
    employee: `0x${string}`,
    totalAmount: bigint,
    lifiCallData: `0x${string}`[]
  ) {
    return writeContractAsync({
      address: CHAIN_PAY_CONTRACT,
      abi: CHAIN_PAY_ABI,
      functionName: 'executePayout',
      args: [employer, employee, totalAmount, lifiCallData],
    })
  }

  return { setRules, approveUsdc, executePayout }
}

// Separate hook for reading rules (wagmi useReadContract is a React hook)
export function useGetRules(employeeAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: CHAIN_PAY_CONTRACT,
    abi: CHAIN_PAY_ABI,
    functionName: 'getRules',
    args: employeeAddress ? [employeeAddress] : undefined,
    query: { enabled: !!employeeAddress },
  })
}

export function useUsdcAllowance(ownerAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: 'allowance',
    args: ownerAddress ? [ownerAddress, CHAIN_PAY_CONTRACT] : undefined,
    query: { enabled: !!ownerAddress },
  })
}
