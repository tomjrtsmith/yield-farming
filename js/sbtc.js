
async function main() {
    console.log("******************* 👨‍🌾 UNOFFICIAL BTC YIELD FARMING CALCULATOR 👨‍🌾 ********************");
    console.log("INFO: https://blog.synthetix.io/btc-yield-farming-pool/");
    console.log("POOL: https://www.curve.fi/sbtc/deposit");
    console.log("STAKE: https://mintr.synthetix.io/");
    console.log("***************************************************************************************\n");

    const App = await init_ethers();

    console.log(`Initialized ${App.YOUR_ADDRESS}`);
    console.log("Reading smart contracts...");

    const CURVE_BTC_POOL = new ethers.Contract(CURVE_BTC_POOL_ADDR, CURVE_BTC_POOL_ABI, App.provider);
    const SYNTH_CRV_POOL = new ethers.Contract(SYNTH_CRV_STAKING_POOL_ADDR, SYNTH_CRV_STAKING_POOL_ABI, App.provider);
    const BALANCER_SNX_REN_POOL = new ethers.Contract(BALANCER_SNX_REN_POOL_ADDR, BALANCER_SNX_REN_POOL_ABI, App.provider);
    const SNX_REN_BPT_TOKEN_CONTRACT = new ethers.Contract(SNX_REN_BPT_TOKEN_ADDRESS, ERC20_ABI, App.provider);
    const crvRenWSBTC_TOKEN_CONTRACT = new ethers.Contract(crvRenWSBTC_TOKEN_ADDR, ERC20_ABI, App.provider);

    // Curve
    const rawStakedCRVAmount = await SYNTH_CRV_POOL.balanceOf(App.YOUR_ADDRESS);
    const stakedCRVAmount = rawStakedCRVAmount / 1e18;

    const renBTCamount = rawStakedCRVAmount <= 0 ? 0 : await CURVE_BTC_POOL.calc_withdraw_one_coin(rawStakedCRVAmount, 0) / 1e8;
    const wBTCamount = rawStakedCRVAmount <= 0 ? 0 : await CURVE_BTC_POOL.calc_withdraw_one_coin(rawStakedCRVAmount, 1) / 1e8;
    const SBTCamount = rawStakedCRVAmount <= 0 ? 0 : await CURVE_BTC_POOL.calc_withdraw_one_coin(rawStakedCRVAmount, 2) / 1e18;

    // Balancer
    const earnedBPT = await SYNTH_CRV_POOL.earned(App.YOUR_ADDRESS) / 1e18;
    const totalBPTAmount = await BALANCER_SNX_REN_POOL.totalSupply() / 1e18;
    const totalSNXAmount = await BALANCER_SNX_REN_POOL.getBalance(SNX_TOKEN_ADDRESS) / 1e18;
    const totalCrvRenWSBTCSupply = await crvRenWSBTC_TOKEN_CONTRACT.totalSupply() / 1e18;
    const totalStakedCrvRenWSBTCAmount = await crvRenWSBTC_TOKEN_CONTRACT.balanceOf(SYNTH_CRV_STAKING_POOL_ADDR) / 1e18;
    const totalRENAmount = await BALANCER_SNX_REN_POOL.getBalance(REN_ADDRESS) / 1e18;

    const SNXperBPT = totalSNXAmount / totalBPTAmount;
    const RENperBPT = totalRENAmount / totalBPTAmount;

    // Query the filter
    const eventFilter = SNX_REN_BPT_TOKEN_CONTRACT.filters.Transfer(PDAO_ADDRESS, SYNTH_CRV_STAKING_POOL_ADDR);
    const current_block_num = App.provider.getBlockNumber();
    const logs = await SNX_REN_BPT_TOKEN_CONTRACT.queryFilter(eventFilter, current_block_num - BLOCK_PER_DAY * 7, current_block_num);

    const latest_log = logs[logs.length - 1];
    const weekly_reward = latest_log.args[2] / 1e18;
    const rewardPerToken = weekly_reward / totalStakedCrvRenWSBTCAmount;

    console.log("Finished reading smart contracts... Looking up prices... \n")

    // CoinGecko price lookup
    const prices = await $.ajax({
        url: "https://api.coingecko.com/api/v3/simple/price?ids=havven%2Crepublic-protocol%2Crenbtc%2Cwrapped-bitcoin%2Csbtc&vs_currencies=usd",
        type: 'GET'
    });

    const SNXprice = prices.havven.usd;
    const RENprice = prices["republic-protocol"].usd;
    const BPTprice = SNXperBPT * SNXprice + RENperBPT * RENprice;

    const renBTCPrice = prices.renbtc.usd;
    const wBTCPrice = prices["wrapped-bitcoin"].usd;
    const SBTCPrice = prices.sbtc.usd;
    const CRVprice = renBTCamount * renBTCPrice / 3 + wBTCamount * wBTCPrice / 3 + SBTCamount * SBTCPrice / 3;

    console.log("========== PRICES ==========")
    console.log(`1 SNX = $${SNXprice}`);
    console.log(`1 REN = $${RENprice}\n`);
    console.log(`1 BPT (79.82% SNX, 20.17% REN) = [${SNXperBPT} SNX, ${RENperBPT} REN]`);
    console.log(`      = $${BPTprice}\n`);

    console.log(`1 renBTC = $${renBTCPrice}`);
    console.log(`1 wBTC = $${wBTCPrice}`);
    console.log(`1 sBTC = $${SBTCPrice}\n`);

    console.log("========= STAKING ==========")
    console.log(`There are total   : ${totalCrvRenWSBTCSupply} crvRenWSBTC given out by Curve.`);
    console.log(`There are total   : ${totalStakedCrvRenWSBTCAmount} crvRenWSBTC staked in Synthetix's pool. \n`);
    console.log(`You are staking   : ${stakedCRVAmount} crvRenWSBTC (${toFixed(100 * stakedCRVAmount / totalStakedCrvRenWSBTCAmount, 3)}% of the pool)`);
    console.log(`                  ≈ $${toFixed(CRVprice, 2)} (Averaged)\n`);

    console.log("====== SNX/REN REWARDS =====")
    console.log(`Claimable Rewards : ${earnedBPT} BPT`);
    console.log(`                  = [${earnedBPT * SNXperBPT} SNX + ${earnedBPT * RENperBPT} REN]`);
    console.log(`                  = $${toFixed(earnedBPT * BPTprice, 2)}\n`)

    console.log(`Weekly estimate   : ${rewardPerToken * stakedCRVAmount} BPT (out of total ${weekly_reward} BPT)`)
    console.log(`                  = $${toFixed((rewardPerToken * stakedCRVAmount) * BPTprice , 2)}\n`)

    console.log("======== BAL REWARDS ========")
    console.log(`    Not distributed yet\n`);

    console.log("======== CRV REWARDS ========")
    console.log(`    Not distributed yet`);
}


(function () {
    let logger = document.getElementById('log');
    console.log = function () {
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == 'object') {
                logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + '<br />';
            } else {
                logger.innerHTML += arguments[i] + '<br />';
            }
        }
    }

    main().then().catch((e) => {
        console.log(e);
        console.error(e);
        console.log("Oops something went wrong.")
    });

})();