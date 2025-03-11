// SPDX-License-Identifier: UNLICENSED

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vesting", function () {
    let owner;
    let other;
    let VestingContract;
    let tokenContract;
    let Vesting;
    let Token;
    let startTime;
    let vestingAddress;

    const cliffDuration = 100;
    const fullVestingPeriod = 300;
    const balance = ethers.parseEther("1000");  // Use proper token decimals
    
    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();

        // Get current block timestamp
        const latestBlock = await ethers.provider.getBlock('latest');
        startTime = latestBlock.timestamp + 100; // Set start time in the future

        // Deploy test tokens
        const TokenContract = await ethers.getContractFactory("TestERC20");
        Token = await TokenContract.deploy("TokenA", "TKA");
        await Token.waitForDeployment();

        // Deploy vesting contract
        const VestingContract = await ethers.getContractFactory("Vesting");
        Vesting = await VestingContract.deploy(
            await Token.getAddress(),
            owner.address,
            startTime,
            cliffDuration,
            fullVestingPeriod,
            balance
        );
        await Vesting.waitForDeployment();
        vestingAddress = await Vesting.getAddress();

        // Transfer tokens to Vesting contract
        await Token.transfer(vestingAddress, balance);
    });

    describe("Vesting Schedule", function () {
        it("Should not vest any tokens before cliff", async function () {
            // Move to start time
            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);
            await ethers.provider.send("evm_mine");
            
            const vestedAmount = await Vesting.getVestingAmount();
            expect(vestedAmount).to.equal(0);
            
            await expect(Vesting.release())
                .to.be.revertedWithCustomError(Vesting, "CliffNotReached");
        });

        it("Should vest tokens linearly after cliff", async function () {
            const quarterVestingTime = Math.floor(fullVestingPeriod / 4);
            const targetTime = startTime + cliffDuration + quarterVestingTime;
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [targetTime]);
            await ethers.provider.send("evm_mine");
            
            const vestedAmount = await Vesting.getVestingAmount();
            // check that amount is less than total balance but greater than 0
            expect(vestedAmount).to.be.lt(balance);
            expect(vestedAmount).to.be.gt(0);
        });

        it("Should vest all tokens after full period", async function () {
            const targetTime = startTime + fullVestingPeriod + 1;
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [targetTime]);
            await ethers.provider.send("evm_mine");
            
            const vestedAmount = await Vesting.getVestingAmount();
            expect(vestedAmount).to.equal(balance);
        });
        // test that beneficiary can release tokens
        it("Should allow beneficiary to release tokens", async function () {
            const targetTime = startTime + cliffDuration + fullVestingPeriod + 1;
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [targetTime]);
            await ethers.provider.send("evm_mine");
            //check balance before and after release    
            const balanceBefore = await Token.balanceOf(owner.address);
            await Vesting.connect(owner).release();
            const balanceAfter = await Token.balanceOf(owner.address);
            expect(balanceAfter).to.equal(balanceBefore + balance);   
        });

        //  - **Withdrawal Logic:** The beneficiary can release tokens without double withdrawals.
        it("Should not allow double withdrawals", async function () {
            const targetTime = startTime + cliffDuration + fullVestingPeriod + 1;
            
            await ethers.provider.send("evm_setNextBlockTimestamp", [targetTime]);
            await ethers.provider.send("evm_mine");
            await Vesting.connect(owner).release();
            await expect(Vesting.connect(owner).release())
                .to.be.revertedWithCustomError(Vesting, "NoTokensToRelease");
        });
    });
}); 
