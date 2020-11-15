require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const BN = require('bn.js');

const types = require('../config/typedefs.json');

const ETHERSCAN_API_URL_MAP = {
    main: 'https://api.etherscan.io',
    kovan: 'https://api-kovan.etherscan.io',
};

const CONTRACT_ADDRESS_MAP = {
    main: '',
    kovan: '0x837421ED118Ec24a000A962c6314D580b8ae6C8e',
}

const getTransactions = async (network, contractaddress, startblock, endblock, apikey) => {
    try {
        const module = 'account';
        const action = 'tokentx';
        const sort = 'asc';
        var queryObject = {
            module, action, contractaddress, startblock, endblock, sort, apikey
        };
        const query = ETHERSCAN_API_URL_MAP[network] + '/api?' + querystring.stringify(queryObject);
        const resp = await axios.get(query);
        const result = JSON.parse(JSON.stringify(resp.data))["result"];
        // console.log(result)
        return result;
    } catch (error) {
        throw new Error(`[getTransactions]: ${error}`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertSuccess(txBuilder, signer) {
    return await new Promise(async (resolve, _reject) => {
        const unsub = await txBuilder.signAndSend(signer, (result) => {
            if (result.status.isInBlock) {
                let error;
                for (const e of result.events) {
                    const { event: { data, method, section } } = e;
                    if (section === 'system' && method === 'ExtrinsicFailed') {
                        error = data[0];
                    }
                }
                if (error) {
                    throw new Error(`Extrinsic failed : ${error}`);
                }
                unsub();
                resolve({
                    hash: result.status.asInBlock,
                    events: result.events,
                });
            } else if (result.status.isInvalid) {
                throw new Error('Invalid transaction');
                unsub();
                resolve();
            }
        });
    });
}

const worker = async () => {
    const network = process.env.NETWORK;
    const contractAddress = CONTRACT_ADDRESS_MAP[network];
    const defultStartBlock = parseInt(process.env.START_BLOCK);
    const apikey = process.env.API_KEY;
    const wsEndPoint = process.env.END_POINT;
    const wsProvider = new WsProvider(wsEndPoint);

    const api = await ApiPromise.create({provider: wsProvider, types});
    await cryptoWaitReady();

    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri(process.env.ACCOUNT_URI);

    const endHeight = await api.query.claimModule.endHeight();
    let startBlock = endHeight.toNumber();
    if (startBlock === 0) {
        startBlock = defultStartBlock
    }
    let latestBlock = 999999999;
    let nowBlock = startBlock + 1;
    let endBlock = nowBlock - 1;

    while (true) {
        console.log(`[worker] crawl from ${nowBlock}`);
        let txs = [];
        try {
            txs = await getTransactions(network, contractAddress, nowBlock, latestBlock, apikey);
            let len = txs.length;
            let claims = new Array();
            for (i = 0; i < len; i++) {
                let tx = txs[i];
                if('0x000000000000000000000000000000000000dead' === tx['to']) {
                    let amount = new BN(tx['value']);
                    amount = amount.divn(1e+3)
                    claims.push([tx['hash'], tx['from'], amount]);
                    endBlock = Math.max(parseInt(tx['blockNumber']), endBlock);
                }
            }
            console.log(claims);
            if(claims.length > 0) {
                await assertSuccess(api.tx.claimModule.storeErc20BurnedTransactions(endBlock, claims), alice);
            }
            nowBlock = endBlock + 1;
        } catch (error) {
            console.log("[worker] crawl error: ", error);
            break;
        }
        console.log("[worker] wait 15s");
        await sleep(15000);
    }
}

worker()

