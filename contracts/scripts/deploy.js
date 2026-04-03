const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const executorAddress = process.env.EXECUTOR_ADDRESS;
  if (!executorAddress) {
    throw new Error("请在 .env 中设置 EXECUTOR_ADDRESS");
  }

  console.log("部署网络:", hre.network.name);
  console.log("执行者地址:", executorAddress);

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("部署者余额:", hre.ethers.formatEther(balance), "ETH");

  // 部署 ChainPay 合约
  const ChainPay = await hre.ethers.getContractFactory("ChainPay");
  const chainPay = await ChainPay.deploy(executorAddress);
  await chainPay.waitForDeployment();

  const contractAddress = await chainPay.getAddress();
  console.log("\nChainPay 合约已部署到:", contractAddress);
  console.log("\n请将以下信息更新到 CLAUDE.md 和后端配置中:");
  console.log("  ChainPay 合约地址:", contractAddress);
  console.log("  部署链:", hre.network.name, "(Chain ID:", hre.network.config.chainId + ")");

  // 等待几个区块确认后验证合约
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n等待 5 个区块确认后验证合约...");
    await chainPay.deploymentTransaction().wait(5);

    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [executorAddress],
      });
      console.log("合约验证成功！");
    } catch (err) {
      console.log("合约验证失败（可稍后手动验证）:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
