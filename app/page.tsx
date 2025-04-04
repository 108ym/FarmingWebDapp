"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wallet, Coins, Loader2 } from "lucide-react"
import { ethers } from "ethers"

// Update these addresses with your deployed LP token addresses
const lpTokens: Record<string, string> = {
  mDAI: "0x789492C8c1445a795a3C4439579A0Df89B557791",
  mUSDC: "0xA5F25C6A6C1ae1Dc0941CfB3c7541F18C868572c",
  mETH: "0xe8aa95A994987cA850ae35443b39ed1deB52aA0f",
}

// Update with your deployed reward token and farming contract addresses
const rewardTokenAddress = "0x51af42917eB1551958A89CE65edd5be0b1cE4240"
const farmingContractAddress = "0x22575a2f08fb2BC328717E0a903B2Cb0e8077274"

export default function LiquidityPage() {
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState("")
  const [lpBalance, setLpBalance] = useState("0.0")
  const [stakedBalance, setStakedBalance] = useState("0.0")
  const [rewardBalance, setRewardBalance] = useState("0.0")
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<null | "success" | "error">(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [selectedPool, setSelectedPool] = useState("mDAI")
  const [poolIndex, setPoolIndex] = useState(0)

  // Update pool index based on selected pool.
  useEffect(() => {
    const indexMap: Record<string, number> = { mDAI: 0, mUSDC: 1, mETH: 2 }
    setPoolIndex(indexMap[selectedPool])
  }, [selectedPool])

  // Connect the user's wallet.
  const connectWallet = async () => {
    setIsLoading(true)
    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed.")

      // Request wallet permissions explicitly.
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      })

      // Request the accounts.
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setAccount(address)
      setConnected(true)
      await updateBalances(provider, address)
    } catch (error) {
      console.error(error)
      setStatusMessage(error instanceof Error ? error.message : "Failed to connect wallet")
      setTxStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  // Update wallet and staked balances for the selected pool.
  const updateBalances = async (provider: ethers.Provider, address: string) => {
    try {
      const tokenAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"]
      const lpToken = new ethers.Contract(lpTokens[selectedPool], tokenAbi, provider)
      const rewardToken = new ethers.Contract(rewardTokenAddress, tokenAbi, provider)
      // For pending rewards from the farming contract.
      const stakingAbi = ["function pendingReward(uint256,address) view returns (uint256)"]
      const staking = new ethers.Contract(farmingContractAddress, stakingAbi, provider)
      // For staked balance in the farming contract.
      const farmingAbi = [
        "function userInfo(uint256,address) view returns (uint256 amount, uint256 rewardDebt, uint256 pendingReward)"
      ]
      const farming = new ethers.Contract(farmingContractAddress, farmingAbi, provider)

      const [lpDec, rewardDec] = await Promise.all([
        lpToken.decimals(),
        rewardToken.decimals(),
      ])

      // Get wallet balance, pending reward, and staked balance.
      const [walletBal, pendingReward, userInfo] = await Promise.all([
        lpToken.balanceOf(address),
        staking.pendingReward(poolIndex, address),
        farming.userInfo(poolIndex, address)
      ])

      setLpBalance(ethers.formatUnits(walletBal, lpDec))
      setRewardBalance(ethers.formatUnits(pendingReward, rewardDec))
      setStakedBalance(ethers.formatUnits(userInfo.amount, lpDec))
    } catch (err) {
      console.error("updateBalances error", err)
      setLpBalance("0.0")
      setRewardBalance("0.0")
      setStakedBalance("0.0")
    }
  }

  // Listen for account and chain changes.
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          setConnected(false)
          setAccount("")
          setLpBalance("0.0")
          setRewardBalance("0.0")
          setStakedBalance("0.0")
        } else {
          setAccount(accounts[0])
          const provider = new ethers.BrowserProvider(window.ethereum)
          updateBalances(provider, accounts[0])
        }
      })

      window.ethereum.on("chainChanged", () => {
        window.location.reload()
      })

      return () => {
        window.ethereum.removeAllListeners("accountsChanged")
        window.ethereum.removeAllListeners("chainChanged")
      }
    }
  }, [connected])

  // Update balances when pool selection or poolIndex changes.
  useEffect(() => {
    if (connected && account) {
      const provider = new ethers.BrowserProvider(window.ethereum)
      updateBalances(provider, account)
    }
  }, [connected, account, selectedPool, poolIndex])

  // Handle deposit of LP tokens.
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return
    setIsLoading(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const lpToken = new ethers.Contract(
        lpTokens[selectedPool],
        [
          "function approve(address,uint256)", 
          "function decimals() view returns (uint8)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        signer
      )
      const staking = new ethers.Contract(
        farmingContractAddress,
        ["function deposit(uint256,uint256)"],
        signer
      )
      const decimals = await lpToken.decimals()
      const amount = ethers.parseUnits(depositAmount, decimals)

      const allowance = await lpToken.allowance(account, farmingContractAddress);
      if (allowance < amount) {
        await (await lpToken.approve(farmingContractAddress, amount)).wait();
      }

      // Deposit LP tokens.
      await (await staking.deposit(poolIndex, amount)).wait()
      await updateBalances(provider, account)
      setDepositAmount("")
      setTxStatus("success")
      setStatusMessage("Deposit successful!")
    } catch (err) {
      console.error("Deposit error:", err)
      setTxStatus("error")
      setStatusMessage("Deposit failed")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle withdrawal of LP tokens.
  // const handleWithdraw = async () => {
  //   if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(lpBalance)) return
  //   setIsLoading(true)
  //   try {
  //     const provider = new ethers.BrowserProvider(window.ethereum)
  //     const signer = await provider.getSigner()
  //     const lpToken = new ethers.Contract(
  //       lpTokens[selectedPool],
  //       ["function decimals() view returns (uint8)"],
  //       provider
  //     )
  //     const staking = new ethers.Contract(
  //       farmingContractAddress,
  //       ["function withdraw(uint256,uint256)"],
  //       signer
  //     )
  //     const decimals = await lpToken.decimals()
  //     const amount = ethers.parseUnits(withdrawAmount, decimals)
  //     await (await staking.withdraw(poolIndex, amount)).wait()
  //     await updateBalances(provider, account)
  //     setWithdrawAmount("")
  //     setTxStatus("success")
  //     setStatusMessage("Withdraw successful!")
  //   } catch (err) {
  //     console.error("Withdraw error:", err)
  //     setTxStatus("error")
  //     setStatusMessage("Withdraw failed")
  //   } finally {
  //     setIsLoading(false)
  //   }
  // }

  const handleWithdrawAndClaim = async () => {
    // Use stakedBalance to ensure the amount is within the staked amount
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > parseFloat(stakedBalance)) return;
    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // Create a contract instance for the Farming contract
      // Assumes the Farming contract withdraw function automatically claims rewards as well.
      const staking = new ethers.Contract(
        farmingContractAddress,
        ["function withdraw(uint256,uint256)"],
        signer
      );
      // Get the LP token decimals (to correctly parse the amount)
      const lpToken = new ethers.Contract(
        lpTokens[selectedPool],
        ["function decimals() view returns (uint8)"],
        provider
      );
      const decimals = await lpToken.decimals();
      const amount = ethers.parseUnits(withdrawAmount, decimals);
      // Call the withdraw function (which also claims rewards)
      await (await staking.withdraw(poolIndex, amount)).wait();
      await updateBalances(provider, account);
      setWithdrawAmount("");
      setTxStatus("success");
      setStatusMessage("Withdraw & Claim successful!");
    } catch (err) {
      console.error("Withdraw error:", err);
      setTxStatus("error");
      setStatusMessage("Withdraw & Claim failed");
    } finally {
      setIsLoading(false);
    }
  };
  

  // Handle reward claims.
  const claimRewards = async () => {
    if (parseFloat(rewardBalance) <= 0) return
    setIsLoading(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const staking = new ethers.Contract(
        farmingContractAddress,
        ["function claimRewards(uint256)", "function pendingReward(uint256,address) view returns (uint256)"],
        signer
      )
      await (await staking.claimRewards(poolIndex)).wait()
      await updateBalances(provider, account)
      setTxStatus("success")
      setStatusMessage("Rewards claimed!")
    } catch (err) {
      console.error("Claim error:", err)
      setTxStatus("error")
      setStatusMessage("Claim failed")
    } finally {
      setIsLoading(false)
    }
  }

  // Reset status messages after a short delay.
  useEffect(() => {
    if (txStatus) {
      const timer = setTimeout(() => {
        setTxStatus(null)
        setStatusMessage("")
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [txStatus])

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">Farming Dapp</h1>
      {!connected ? (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect your wallet to manage your LP tokens and rewards</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={connectWallet} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />Connect Wallet
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="flex justify-between mb-4">
            <div className="flex items-center">
              <Wallet className="mr-2 h-5 w-5" />
              <span className="text-sm font-medium">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
            </div>
            <select
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="mDAI">mDAI</option>
              <option value="mUSDC">mUSDC</option>
              <option value="mETH">mETH</option>
            </select>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground">Wallet LP Balance</span>
              <span className="font-bold">{lpBalance}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground">Your Liquidity Deposited</span>
              <span className="font-bold">{stakedBalance}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground">Claimable Rewards</span>
              <span className="font-bold">{rewardBalance}</span>
            </div>
          </div>

          {txStatus && (
            <Alert
              className={`mb-6 ${
                txStatus === "success"
                  ? "bg-green-50 text-green-800 border-green-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="claim">Claim Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Card>
                <CardHeader>
                  <CardTitle>Deposit LP Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.0"
                      type="number"
                    />
                    <Button variant="outline" onClick={() => setDepositAmount(lpBalance)}>
                      MAX
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleDeposit} disabled={isLoading || !depositAmount}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...
                      </>
                    ) : (
                      <>Deposit</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw LP Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Withdraw Input Section */}
                  <div className="flex gap-2">
                    <Input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.0"
                      type="number"
                    />
                    <Button variant="outline" onClick={() => setWithdrawAmount(stakedBalance)}>
                      MAX
                    </Button>
                  </div>
                  {/* Unclaimed Rewards Display */}
                  <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">Unclaimed Rewards</p>
                    <p className="text-2xl font-bold">{rewardBalance}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleWithdrawAndClaim} disabled={isLoading || !withdrawAmount}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...
                      </>
                    ) : (
                      <>Withdraw & Claim</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>



            <TabsContent value="claim">
              <Card>
                <CardHeader>
                  <CardTitle>Claim Rewards</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Coins className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{rewardBalance}</p>
                  <p className="text-sm text-muted-foreground">Available Rewards</p>
                </CardContent>
                <CardFooter>
                  <Button onClick={claimRewards} disabled={isLoading || parseFloat(rewardBalance) <= 0}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...
                      </>
                    ) : (
                      <>Claim Rewards</>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
