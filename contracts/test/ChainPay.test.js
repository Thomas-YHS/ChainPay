const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainPay", function () {
  let chainPay;
  let mockUSDC;
  let mockLiFi;
  let owner;
  let executor;
  let employer;
  let employee;
  let stranger;

  beforeEach(async function () {
    [owner, executor, employer, employee, stranger] = await ethers.getSigners();

    // 部署 Mock USDC（6 位小数）
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();

    // 部署 Mock LiFi
    const MockLiFi = await ethers.getContractFactory("MockLiFi");
    mockLiFi = await MockLiFi.deploy();
    await mockLiFi.waitForDeployment();

    // 部署可注入地址的测试版 ChainPay
    const ChainPayTest = await ethers.getContractFactory("ChainPayTest");
    chainPay = await ChainPayTest.deploy(
      executor.address,
      await mockUSDC.getAddress(),
      await mockLiFi.getAddress()
    );
    await chainPay.waitForDeployment();

    // 给雇主 mint 1000 USDC
    const mintAmount = ethers.parseUnits("1000", 6);
    await mockUSDC.mint(employer.address, mintAmount);
  });

  // ===================== registerEmployee =====================
  describe("registerEmployee", function () {
    it("雇主可以注册员工", async function () {
      await expect(chainPay.connect(employer).registerEmployee(employee.address))
        .to.emit(chainPay, "EmployeeRegistered");

      expect(await chainPay.employeeEmployer(employee.address)).to.equal(
        employer.address
      );

      const employees = await chainPay.getEmployees(employer.address);
      expect(employees).to.include(employee.address);
    });

    it("不能注册零地址", async function () {
      await expect(
        chainPay.connect(employer).registerEmployee(ethers.ZeroAddress)
      ).to.be.revertedWith("ChainPay: employee is zero address");
    });

    it("不能重复注册同一员工", async function () {
      await chainPay.connect(employer).registerEmployee(employee.address);
      await expect(
        chainPay.connect(employer).registerEmployee(employee.address)
      ).to.be.revertedWith("ChainPay: employee already registered");
    });

    it("不能被另一个雇主抢注", async function () {
      await chainPay.connect(employer).registerEmployee(employee.address);
      await expect(
        chainPay.connect(stranger).registerEmployee(employee.address)
      ).to.be.revertedWith("ChainPay: employee already registered");
    });
  });

  // ===================== setRules =====================
  describe("setRules", function () {
    beforeEach(async function () {
      await chainPay.connect(employer).registerEmployee(employee.address);
    });

    it("员工可以设置规则（单条 100%）", async function () {
      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 10000 },
      ];
      await expect(chainPay.connect(employee).setRules(rules)).to.emit(
        chainPay,
        "RulesSet"
      );

      expect(await chainPay.hasRules(employee.address)).to.be.true;
      const stored = await chainPay.getRules(employee.address);
      expect(stored.length).to.equal(1);
      expect(stored[0].percentage).to.equal(10000);
    });

    it("员工可以设置多条规则（总和 = 10000）", async function () {
      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 6000 },
        { chainId: 42161, tokenAddress: ethers.ZeroAddress, percentage: 4000 },
      ];
      await chainPay.connect(employee).setRules(rules);
      const stored = await chainPay.getRules(employee.address);
      expect(stored.length).to.equal(2);
    });

    it("规则总和不等于 10000 时 revert", async function () {
      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 5000 },
        { chainId: 42161, tokenAddress: ethers.ZeroAddress, percentage: 3000 },
      ];
      await expect(
        chainPay.connect(employee).setRules(rules)
      ).to.be.revertedWith("ChainPay: percentages must sum to 10000");
    });

    it("规则条数超过 5 条时 revert", async function () {
      const rules = Array(6).fill({
        chainId: 8453,
        tokenAddress: ethers.ZeroAddress,
        percentage: 1000,
      });
      await expect(
        chainPay.connect(employee).setRules(rules)
      ).to.be.revertedWith("ChainPay: too many rules");
    });

    it("未注册的员工不能设置规则", async function () {
      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 10000 },
      ];
      await expect(
        chainPay.connect(stranger).setRules(rules)
      ).to.be.revertedWith("ChainPay: not a registered employee");
    });

    it("规则只能设置一次", async function () {
      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 10000 },
      ];
      await chainPay.connect(employee).setRules(rules);
      await expect(
        chainPay.connect(employee).setRules(rules)
      ).to.be.revertedWith("ChainPay: rules already set");
    });

    it("chainId 为 0 时 revert", async function () {
      const rules = [
        { chainId: 0, tokenAddress: ethers.ZeroAddress, percentage: 10000 },
      ];
      await expect(
        chainPay.connect(employee).setRules(rules)
      ).to.be.revertedWith("ChainPay: invalid chainId");
    });
  });

  // ===================== executePayout =====================
  describe("executePayout", function () {
    const totalAmount = ethers.parseUnits("100", 6); // 100 USDC

    beforeEach(async function () {
      await chainPay.connect(employer).registerEmployee(employee.address);

      const rules = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 5000 },
        { chainId: 42161, tokenAddress: ethers.ZeroAddress, percentage: 5000 },
      ];
      await chainPay.connect(employee).setRules(rules);

      await mockUSDC
        .connect(employer)
        .approve(await chainPay.getAddress(), totalAmount);
    });

    it("执行者可以触发发薪", async function () {
      const lifiCallData = [
        ethers.toUtf8Bytes("lifi_call_1"),
        ethers.toUtf8Bytes("lifi_call_2"),
      ];

      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            employer.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.emit(chainPay, "PayoutExecuted");
    });

    it("三条 33.33%/33.33%/33.34% 规则：合约无 USDC 残留", async function () {
      // 这个测试专门验证 Issue 1 精度修复
      // 重新注册员工并设置三条规则（总和 = 10000，但整除会产生截断）
      // 取第 5、6 个 signer（index 5、6），避免与 beforeEach 中已用的地址冲突
      const signers = await ethers.getSigners();
      const freshEmployer = signers[5];
      const freshEmployee = signers[6];
      const freshAmount = ethers.parseUnits("100", 6); // 100 USDC

      await mockUSDC.mint(freshEmployer.address, freshAmount);

      await chainPay.connect(freshEmployer).registerEmployee(freshEmployee.address);
      const rules3 = [
        { chainId: 8453, tokenAddress: ethers.ZeroAddress, percentage: 3333 },
        { chainId: 42161, tokenAddress: ethers.ZeroAddress, percentage: 3333 },
        { chainId: 100, tokenAddress: ethers.ZeroAddress, percentage: 3334 },
      ];
      await chainPay.connect(freshEmployee).setRules(rules3);
      await mockUSDC
        .connect(freshEmployer)
        .approve(await chainPay.getAddress(), freshAmount);

      // MockLiFi 需要 abi.encode(tokenAddress, amount) 格式的 calldata 才会真正转账
      // 三条规则金额：33_330_000 / 33_330_000 / 33_340_000（最后一条用余量）
      const usdcAddr = await mockUSDC.getAddress();
      const lifiCallData = [
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256"], [usdcAddr, ethers.parseUnits("33.33", 6)]
        ),
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256"], [usdcAddr, ethers.parseUnits("33.33", 6)]
        ),
        // 最后一条金额 = 100 - 33.33 - 33.33 = 33.34（用余量，消除精度损失）
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256"], [usdcAddr, ethers.parseUnits("33.34", 6)]
        ),
      ];

      await chainPay
        .connect(executor)
        .executePayout(
          freshEmployer.address,
          freshEmployee.address,
          freshAmount,
          lifiCallData
        );

      // 发薪后合约内不应有任何 USDC 残留
      const contractBalance = await mockUSDC.balanceOf(await chainPay.getAddress());
      expect(contractBalance).to.equal(0);
    });

    it("非执行者不能触发发薪", async function () {
      const lifiCallData = [
        ethers.toUtf8Bytes("lifi_call_1"),
        ethers.toUtf8Bytes("lifi_call_2"),
      ];
      await expect(
        chainPay
          .connect(stranger)
          .executePayout(
            employer.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWith("ChainPay: not executor");
    });

    it("calldata 数量与规则不匹配时 revert", async function () {
      const lifiCallData = [ethers.toUtf8Bytes("only_one")];
      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            employer.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWith("ChainPay: calldata length mismatch");
    });

    it("allowance 不足时 revert", async function () {
      await mockUSDC.connect(employer).approve(await chainPay.getAddress(), 0);

      const lifiCallData = [
        ethers.toUtf8Bytes("lifi_call_1"),
        ethers.toUtf8Bytes("lifi_call_2"),
      ];
      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            employer.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWith("ChainPay: insufficient allowance");
    });

    it("员工未设置规则时 revert", async function () {
      await chainPay.connect(employer).registerEmployee(stranger.address);

      const lifiCallData = [ethers.toUtf8Bytes("lifi_call_1")];
      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            employer.address,
            stranger.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWith("ChainPay: employee has no rules");
    });

    it("雇主/员工不匹配时 revert", async function () {
      const lifiCallData = [
        ethers.toUtf8Bytes("lifi_call_1"),
        ethers.toUtf8Bytes("lifi_call_2"),
      ];
      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            stranger.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWith("ChainPay: employer/employee mismatch");
    });

    it("合约暂停时不能发薪", async function () {
      await chainPay.connect(owner).pause();

      const lifiCallData = [
        ethers.toUtf8Bytes("lifi_call_1"),
        ethers.toUtf8Bytes("lifi_call_2"),
      ];
      await expect(
        chainPay
          .connect(executor)
          .executePayout(
            employer.address,
            employee.address,
            totalAmount,
            lifiCallData
          )
      ).to.be.revertedWithCustomError(chainPay, "EnforcedPause");
    });
  });

  // ===================== rescueTokens =====================
  describe("rescueTokens", function () {
    it("Owner 可在暂停状态下提取滞留 Token", async function () {
      // 模拟有 USDC 滞留在合约（直接 mint 到合约地址）
      const stuckAmount = ethers.parseUnits("10", 6);
      await mockUSDC.mint(await chainPay.getAddress(), stuckAmount);

      await chainPay.connect(owner).pause();

      const beforeBalance = await mockUSDC.balanceOf(owner.address);
      await chainPay
        .connect(owner)
        .rescueTokens(await mockUSDC.getAddress(), owner.address, stuckAmount);
      const afterBalance = await mockUSDC.balanceOf(owner.address);

      expect(afterBalance - beforeBalance).to.equal(stuckAmount);
    });

    it("未暂停时不能 rescue", async function () {
      const stuckAmount = ethers.parseUnits("10", 6);
      await mockUSDC.mint(await chainPay.getAddress(), stuckAmount);

      await expect(
        chainPay
          .connect(owner)
          .rescueTokens(await mockUSDC.getAddress(), owner.address, stuckAmount)
      ).to.be.revertedWithCustomError(chainPay, "ExpectedPause");
    });

    it("非 Owner 不能 rescue", async function () {
      await chainPay.connect(owner).pause();
      const stuckAmount = ethers.parseUnits("10", 6);
      await mockUSDC.mint(await chainPay.getAddress(), stuckAmount);

      await expect(
        chainPay
          .connect(stranger)
          .rescueTokens(await mockUSDC.getAddress(), stranger.address, stuckAmount)
      ).to.be.revertedWithCustomError(chainPay, "OwnableUnauthorizedAccount");
    });

    it("rescue 到零地址时 revert", async function () {
      await chainPay.connect(owner).pause();
      await expect(
        chainPay
          .connect(owner)
          .rescueTokens(await mockUSDC.getAddress(), ethers.ZeroAddress, 1)
      ).to.be.revertedWith("ChainPay: rescue to zero address");
    });
  });

  // ===================== setExecutor =====================
  describe("setExecutor", function () {
    it("Owner 可以更新执行者地址", async function () {
      await expect(chainPay.connect(owner).setExecutor(stranger.address))
        .to.emit(chainPay, "ExecutorUpdated")
        .withArgs(executor.address, stranger.address);

      expect(await chainPay.executor()).to.equal(stranger.address);
    });

    it("非 Owner 不能更新执行者", async function () {
      await expect(
        chainPay.connect(stranger).setExecutor(stranger.address)
      ).to.be.revertedWithCustomError(chainPay, "OwnableUnauthorizedAccount");
    });

    it("不能设置零地址为执行者", async function () {
      await expect(
        chainPay.connect(owner).setExecutor(ethers.ZeroAddress)
      ).to.be.revertedWith("ChainPay: new executor is zero address");
    });
  });
});
