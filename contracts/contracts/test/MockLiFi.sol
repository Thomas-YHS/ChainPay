// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev 仅用于测试的 Li.Fi Diamond Mock
 *
 * 真实的 Li.Fi Diamond 在收到调用时会：
 *   1. 从调用方（ChainPay 合约）transferFrom USDC（已 approve 给自己的额度）
 *   2. 执行跨链桥接，将资金路由到目标链
 *
 * 这个 Mock 仅做第 1 步（把 USDC 从 ChainPay 合约转入自身），
 * 模拟资金离开 ChainPay 合约的行为，用于验证精度修复。
 *
 * calldata 格式：abi.encode(tokenAddress, amount)
 * 如果 calldata 无法解码，则直接 return（兼容其他测试用例的任意 bytes）
 */
contract MockLiFi {
    fallback() external payable {
        if (msg.data.length < 64) {
            return; // calldata 不足，跳过（兼容旧测试）
        }
        (address token, uint256 amount) = abi.decode(msg.data, (address, uint256));
        if (token != address(0) && amount > 0) {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
    }

    receive() external payable {}
}
