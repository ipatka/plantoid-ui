import { Button, Col, Menu, Row, Input, Divider, List, Image } from "antd";
import "antd/dist/antd.css";
import { gql, useQuery } from "@apollo/client";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useEventListener } from "eth-hooks/events/useEventListener";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "react-router-dom";
import GraphiQL from "graphiql";
import "graphiql/graphiql.min.css";
import fetch from "isomorphic-fetch";
import "./App.css";
import {
  About,
  Account,
  Contract,
  Address,
  Faucet,
  GasGauge,
  Header,
  Ramp,
  ThemeSwitch,
  NetworkDisplay,
  FaucetHint,
  NetworkSwitch,
  AddressInput,
  EtherInput,
  Events,
  BytesStringInput,
  Proposals,
} from "./components";
import { NETWORKS, ALCHEMY_KEY } from "./constants";
import externalContracts from "./contracts/external_contracts";
import PlantoidABI from "./contracts/plantoid";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor, Web3ModalSetup } from "./helpers";
import { Home, ExampleUI, Hints, Subgraph } from "./views";
import { useStaticJsonRPC } from "./hooks";
import { ZERO_ADDRESS } from "./components/Swap";

import { safeSignTypedData, encodeMultiSend, MetaTransaction } from "@gnosis.pm/safe-contracts";
import Reveal from "./components/Reveal";

const { ethers, BigNumber } = require("ethers");

/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/scaffold-eth/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Alchemy.com & Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

/// 📡 What chain are your contracts deployed to?
// const initialNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)
const initialNetwork = NETWORKS.mainnet; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;
const USE_BURNER_WALLET = true; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = false;

const ZERO_ADDRESS_STRING = "0x0000000000000000000000000000000000000000";

const web3Modal = Web3ModalSetup();

// 🛰 providers
const providers = [`https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`, "https://rpc.scaffoldeth.io:48544"];

function App(props) {
  // specify all the chains your app is available on. Eg: ['localhost', 'mainnet', ...otherNetworks ]
  // reference './constants.js' for other networks
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();
  const [txValue, setTxValue] = useState();
  const [selectedNetwork, setSelectedNetwork] = useState(networkOptions[0]);

  const location = useLocation();

  const feedPlantoid = async plantoidAddress => {
    try {
      await userSigner.sendTransaction({ to: plantoidAddress, value: ethers.utils.parseEther(txValue) });
    } catch (error) {
      console.log({ error });
    }
  };

  const startProposals = async () => {
    try {
      // const plantoid = new ethers.Contract(plantoidAddress, PlantoidABI, localProvider);
      // await plantoid.startVoting();
      await writeContracts.plantoid.startProposals();
    } catch (error) {
      console.log({ error });
    }
  };

  const targetNetwork = NETWORKS[selectedNetwork];

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const localProvider = useStaticJsonRPC([
    process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : targetNetwork.rpcUrl,
  ]);
  const mainnetProvider = useStaticJsonRPC(providers);

  if (DEBUG) console.log(`Using ${selectedNetwork} network`);

  // 🛰 providers
  if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider, USE_BURNER_WALLET);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };
  console.log({ contractConfig });

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  const roundAndState = useContractReader(readContracts, "plantoid", "currentRoundState");
  const round = roundAndState?._round;
  const roundState = roundAndState?._state;
  console.log({ roundAndState, round, roundState });

  // const plantoidAddress = "0x6EfCB0349CCA3d60763646B0df19EfdC7Ebfa85E".toLowerCase();
  // const plantoidAddress = "0xF8F838dC69D59eA02EE0e25d7F0E982a6248f58d".toLowerCase();
  const plantoidAddress = "0x6949bc5Fb1936407bEDd9F3757DA62147741f2A1".toLowerCase();

  const EXAMPLE_GRAPHQL = `query getPlantoid($address: String, $roundId: String, $plantoidAddress: String) @api(contextKey: "apiName")
  {
    seeds {
      id
      holder {
        address
        seedCount
      }
      tokenId
      uri
      revealed
      revealedUri
      revealedSignature
    }
    holders {
      address
      seedCount
    }
    round (id: $roundId) {
      id
      proposals {
        id
        proposalId
        voteCount
        uri
      }
      proposalEnd
      votingEnd
      graceEnd
      totalVotes
      winningProposal {
        id
        proposer
      }
    }
    holder(id: $address) {
      seeds {
        id
      holder {
        address
        seedCount
      }
      tokenId
      uri
      revealed
      revealedUri
      revealedSignature
      }
      seedCount
    }
    plantoidInstance(id: $plantoidAddress) {
      id
      oracle
    }
  }
  `;
  const EXAMPLE_GQL = gql(EXAMPLE_GRAPHQL);
  const { loading, error, data } = useQuery(EXAMPLE_GQL, {
    pollInterval: 2500,
    context: { apiName: "mainnet" },
    variables: {
      address: address ? address.toLowerCase() : ZERO_ADDRESS,
      roundId: round ? plantoidAddress + "_0x" + round : 0,
      plantoidAddress,
    },
  });

  console.log({ error, data });
  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // keep track of a variable from the contract in the local React state:

  const artist = useContractReader(readContracts, "plantoid", "artist");
  const owner = useContractReader(readContracts, "plantoid", "owner");

  console.log({ artist });
  console.log({ owner });

  const plantoidAddressRead = readContracts?.plantoid?.address;

  console.log({ round, roundState, plantoidAddressRead });

  console.log("NUMBER OF IDss---------- " + data?.seeds.length);

  const threshold = useContractReader(readContracts, "plantoid", "threshold");
  const escrow = useContractReader(readContracts, "plantoid", "escrow");

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetContracts);
      console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetContracts,
    localChainId,
    myMainnetDAIBalance,
  ]);

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const plantoidBalance = useBalance(localProvider, plantoidAddress);

  const events = useEventListener(readContracts, "plantoid", "Deposit", localProvider, 10983913);

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header title="🥀 Plantoid" link="http://plantoid.org" subTitle="a blockchain-based life-form">
        {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flex: 1 }}>
            {USE_NETWORK_SELECTOR && (
              <div style={{ marginRight: 20 }}>
                <NetworkSwitch
                  networkOptions={networkOptions}
                  selectedNetwork={selectedNetwork}
                  setSelectedNetwork={setSelectedNetwork}
                />
              </div>
            )}
            <Account
              // useBurner={USE_BURNER_WALLET}
              address={address}
              // localProvider={localProvider}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              price={price}
              web3Modal={web3Modal}
              loadWeb3Modal={loadWeb3Modal}
              logoutOfWeb3Modal={logoutOfWeb3Modal}
              blockExplorer={blockExplorer}
            />
          </div>
        </div>
      </Header>

      {yourLocalBalance.lte(ethers.BigNumber.from("0")) && (
        <FaucetHint localProvider={localProvider} targetNetwork={targetNetwork} address={address} />
      )}
      {/* <NetworkDisplay
        NETWORKCHECK={NETWORKCHECK}
        localChainId={localChainId}
        selectedChainId={selectedChainId}
        targetNetwork={targetNetwork}
        logoutOfWeb3Modal={logoutOfWeb3Modal}
        USE_NETWORK_SELECTOR={USE_NETWORK_SELECTOR}
      /> */}

      <div>
        <hr class="style-eight"></hr>
        <span class="balivia">Welcome </span>
        <br />
        <span class="balivia">{address} </span>
        <br />
        <br />
        You are the lucky owner of <span class="balivia"> {data?.holder?.seeds.length || 0} </span> Plantoid seeds.
        <br></br>
        Total seeds in circulation: <span class="balivia">{data?.seeds.length || "???"}</span>
        <hr class="style-eight"></hr>
      </div>

      <Menu style={{ textAlign: "center", marginTop: 20 }} selectedKeys={[location.pathname]} mode="horizontal">
        <Menu.Item key="/">
          <Link to="/">Feed Plantoid</Link>
        </Menu.Item>
        <Menu.Item key="/reveal">
          <Link to="/reveal">Claim NFTs</Link>
        </Menu.Item>
        <Menu.Item key="/about">
          <Link to="/about">About</Link>
        </Menu.Item>

        {/* only display these menu items, if the connected users is the plantoid  */}

        {owner}
        {/* { (address == plantoidAddress) && (<span> FUCK </span>) }   */}

        <Menu.Item key="/subgraph">
          <Link to="/subgraph">Subgraph</Link>
        </Menu.Item>

        <Menu.Item key="/contracts">
          <Link to="/contracts">Contracts</Link>
        </Menu.Item>
      </Menu>

      <Switch>
        <Route exact path="/">
          {/* pass in any web3 props to this Home component. For example, yourLocalBalance */}
          <div>
            <div style={{ border: "1px solid #cccccc", padding: 16, width: 800, margin: "auto", marginTop: 64 }}>
              <h2>Plantoid #13</h2>
              <Divider />
              <div style={{ margin: 8 }}></div>

              <table>
                <td>
                  <Image
                    style={{ border: "1px solid ", marginLeft: "-50px" }}
                    width={350}
                    height={520}
                    src="https://gateway.pinata.cloud/ipfs/QmcNY71soxdqjNhhwQkfLFDGRx4kaVva7ERFiNWa1ZFk5m"
                  />
                </td>
                <td valign="top">
                  <table align="right">
                    <td align="right">Smart Contract:</td>
                    <td>
                      <Address
                        address={plantoidAddress}
                        ensProvider={mainnetProvider}
                        blockExplorer={blockExplorer}
                        fontSize={24}
                      />
                    </td>
                    <tr />

                    <td align="right">Artist: </td>
                    <td>
                      <Address
                        address={artist}
                        ensProvider={mainnetProvider}
                        blockExplorer={blockExplorer}
                        fontSize={24}
                      />
                    </td>
                    <tr />

                    <td>
                      <Divider />
                    </td>
                    <tr />

                    <td align="right">Current balance:</td>
                    <td> {ethers.utils.formatEther(plantoidBalance.toString())}</td>
                    <tr />
                    <td>Required threshold:</td>
                    <td>{threshold ? ethers.utils.formatEther(threshold.toString()) : "???"}</td>
                    <tr />
                    <td>Currently in escrow:</td>
                    <td>{escrow ? ethers.utils.formatEther(escrow.toString()) : "???"}</td>
                  </table>
                </td>
              </table>

              <Divider />
              <h2>Feed me !</h2>
              <EtherInput
                price={price}
                value={txValue}
                onChange={value => {
                  setTxValue(value);
                }}
              />
              <Button
                disabled={!txValue}
                onClick={() => {
                  /* look how we call setPurpose AND send some value along */
                  feedPlantoid(plantoidAddress);
                  /* this will fail until you make the setPurpose function payable */
                }}
              >
                Feed
              </Button>
              {roundState === 0 && plantoidBalance >= threshold && (
                <Button
                  disabled={plantoidBalance < threshold}
                  onClick={() => {
                    startProposals();
                  }}
                >
                  Start submissions
                </Button>
              )}
              <br />
              <Divider />
              {roundState > 0 ? (
                <Proposals
                  plantoidAddress={plantoidAddress}
                  userSigner={userSigner}
                  user={address}
                  graphData={data}
                  round={round}
                  roundState={roundState}
                />
              ) : (
                <br></br>
              )}
            </div>
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <h2>Events:</h2>
              <List
                bordered
                dataSource={events}
                renderItem={item => {
                  console.log({ item });
                  return (
                    <List.Item key={item.blockNumber + "_" + item.args.sender + "_" + item.args.depositIndex}>
                      {item.args[0].toString()}
                      <Address address={item.args[1]} ensProvider={mainnetProvider} fontSize={16} />
                      {item.args[2].toString()}
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>
        </Route>
        <Route exact path="/reveal">
          {/* pass in any web3 props to this Home component. For example, yourLocalBalance */}
          <Reveal
            address={address}
            plantoidAddress={plantoidAddress}
            userSigner={userSigner}
            user={address}
            graphData={data}
            round={round}
            roundState={roundState}
            mainnetProvider={mainnetProvider}
          ></Reveal>
        </Route>

        <Route exact path="/about">
          <About></About>
        </Route>

        <Route exact path="/contracts">
          {/*
                🎛 this scaffolding is full of commonly used components
                this <Contract/> component will automatically parse your ABI
                and give you a form to interact with it locally
            */}

          <Contract
            name="PlantoidMetadata"
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
          <Contract
            name="Plantoid"
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
        </Route>
      </Switch>

      <ThemeSwitch />

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        {/* <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row> */}

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
