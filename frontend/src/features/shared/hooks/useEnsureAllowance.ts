import { useAccount, usePublicClient, useSendTransaction } from 'wagmi'
import { encodeFunctionData } from 'viem'

const ERC20_ABI = [
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
] as const

export function useEnsureAllowance() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { sendTransactionAsync } = useSendTransaction()

  async function ensureAllowance(
    tokenAddress: `0x${string}`,
    approvalAddress: `0x${string}`,
    amount: bigint
  ) {
    if (!address || !publicClient) throw new Error('Wallet not connected')
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, approvalAddress],
    })
    if (allowance < amount) {
      const approveTx = await sendTransactionAsync({
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [approvalAddress, amount],
        }),
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
    }
  }

  return { ensureAllowance }
}
