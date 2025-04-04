// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../src/RewardToken.sol"; // Adjust the path as needed

contract Farming is Ownable {
    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;            // Address of LP token contract.
        uint256 allocPoint;        // Allocation points for this pool (reward share).
        uint256 lastRewardBlock;   // Last block number that rewards distribution occurred.
        uint256 accRewardPerShare; // Accumulated rewards per share, multiplied by 1e12.
    }

    // Info of each user that stakes LP tokens.
    struct UserInfo {
        uint256 amount;        // How many LP tokens the user has deposited.
        uint256 rewardDebt;    // Reward debt for accounting.
        uint256 pendingReward; // Accumulated rewards that have not been claimed.
    }

    // Use the RewardToken type so we can call mint() directly.
    RewardToken public rewardToken;
    // Reward tokens created per block (200 tokens per block, with 18 decimals)
    uint256 public rewardPerBlock = 200 * 1e18;

    // Array of pool information.
    PoolInfo[] public poolInfo;
    // Mapping of pool ID => user address => user info.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    // Total allocation points across all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when farming starts.
    uint256 public startBlock;

    event PoolAdded(uint256 indexed pid, address lpToken, uint256 allocPoint);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(RewardToken _rewardToken, uint256 _startBlock, address initialOwner)
        Ownable(initialOwner)
    {
        rewardToken = _rewardToken;
        startBlock = _startBlock;
    }

    // Add a new LP token pool. Only callable by the owner.
    function addPool(IERC20 _lpToken, uint256 _allocPoint) external onlyOwner {
        totalAllocPoint += _allocPoint;
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: block.number > startBlock ? block.number : startBlock,
            accRewardPerShare: 0
        }));
        emit PoolAdded(poolInfo.length - 1, address(_lpToken), _allocPoint);
    }

    // Update reward variables for the given pool.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) return;

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 blocks = block.number - pool.lastRewardBlock;
        uint256 reward = (blocks * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        pool.accRewardPerShare += (reward * 1e12) / lpSupply;
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens into the farming contract.
    function deposit(uint256 _pid, uint256 _amount) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        // Update the pool to the latest block.
        updatePool(_pid);

        // Calculate new rewards earned since the last interaction and add them to pendingReward.
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accRewardPerShare) / 1e12 - user.rewardDebt;
            user.pendingReward += pending;
        }

        // Process deposit.
        if (_amount > 0) {
            pool.lpToken.transferFrom(msg.sender, address(this), _amount);
            user.amount += _amount;
            emit Deposit(msg.sender, _pid, _amount);
        }
        // Update reward debt after deposit.
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
    }

    // Withdraw LP tokens from the farming contract and claims rewards during withdrawal
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Farming: insufficient balance");
        updatePool(_pid);

        // Calculate rewards accrued since the last interaction and add them to pendingReward.
        uint256 pending = (user.amount * pool.accRewardPerShare) / 1e12 - user.rewardDebt;
        user.pendingReward += pending;

        // Process LP token withdrawal.
        if (_amount > 0) {
            user.amount -= _amount;
            pool.lpToken.transfer(msg.sender, _amount);
            emit Withdraw(msg.sender, _pid, _amount);
        }

        // Automatically claim rewards: mint the entire pending reward balance
        uint256 rewardsToClaim = user.pendingReward;
        if (rewardsToClaim > 0) {
            user.pendingReward = 0; // reset pending rewards
            safeRewardTransfer(msg.sender, rewardsToClaim);
            emit RewardClaimed(msg.sender, _pid, rewardsToClaim);
        }

        // Update reward debt to reflect the new stake amount.
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
    }


    // Claim all accumulated rewards.
    function claimRewards(uint256 _pid) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        // Update pool to include the latest rewards.
        updatePool(_pid);

        // Calculate any new pending rewards.
        uint256 pending = (user.amount * pool.accRewardPerShare) / 1e12 - user.rewardDebt;
        uint256 totalPending = user.pendingReward + pending;
        require(totalPending > 0, "No rewards to claim");

        // Reset pending rewards and update reward debt.
        user.pendingReward = 0;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;

        // Mint reward tokens on demand to the user.
        safeRewardTransfer(msg.sender, totalPending);
        emit RewardClaimed(msg.sender, _pid, totalPending);
    }

    // View function to check the pending reward for a user.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 blocks = block.number - pool.lastRewardBlock;
            uint256 reward = (blocks * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / lpSupply;
        }
        uint256 pending = (user.amount * accRewardPerShare) / 1e12 - user.rewardDebt;
        return user.pendingReward + pending;
    }

    // Mint reward tokens on demand instead of transferring from a pre-funded balance.
    function safeRewardTransfer(address _to, uint256 _amount) internal {
        rewardToken.mint(_to, _amount);
    }
}
