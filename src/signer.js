const  ethers = require('ethers');
const { decodeAddress } = require("@polkadot/util-crypto");
const { u8aToHex } = require('@polkadot/util');

function address2Hex(address) {
    return u8aToHex(decodeAddress(address));
}

const signer = async () => {
    // mnemonic for testing only
    const mnemonic = "engage wrist twin hole like orient note muffin educate craft fantasy auto";
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);

    const address = wallet.address;
    console.log('addrrss:', address);

    const ERC20Address = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
    const ethTxHash = '9c944a0627a9032489f0673246d1f272032f47d29857500ddb7e891c1287079a';

    let hexERC20Address = address2Hex(ERC20Address);
    hexERC20Address = hexERC20Address.substr(2, hexERC20Address.length - 2);
    const msgBytes = ethers.utils.arrayify('0x'+ hexERC20Address + ethTxHash);
    const signature = await wallet.signMessage(msgBytes);
    console.log('signature:', signature);
}
signer()
