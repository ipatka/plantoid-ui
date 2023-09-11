import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import axios from 'axios';
import ABI from './abi.json'

import { gql, useQuery } from "@apollo/client";

import { Table, Button } from "antd";
import { Divider, Image } from "antd";

import PlantoidABI from "../contracts/plantoid";
import { Address } from "../components";

import _ from "lodash";

import '../themes/NFTDisplay.css'; // Assuming you have a CSS file for styling

const { ethers } = require("ethers");

const ipfsBase = "https://gateway.ipfs.io/ipfs/";

export default function Gallery({
  address,
  plantoidAddress,
  userSigner,
  user,
  graphData,
  round,
  roundState,
  mainnetProvider,
  ipfsContent,

}) {

//   const MD_QUERY = gql`
//   query MdQuery($id: String) @api(contextKey: "apiName") {
//     plantoidMetadata(id: $id) {
//       id
//       seedMetadatas {
//         id
//         revealedUri
//         revealedSignature
//       }
//     }
//   }
// `;
// const { loading, error, data } = useQuery(MD_QUERY, {
//   pollInterval: 2500,
//   context: { apiName: "metadata" },
//   variables: {
//     id: plantoidAddress,
//   },
// });

// const revealColumns = [
// {
//       title: "Seed",
//       key: "token",
//       render: record => record.tokenId,
//       // sorter: {
//       //   compare: (a,b) => a.tokenId - b.tokenId
//       // }
// }];


if (address) {
  console.log("address is ....", address);
  console.log("GRAPH DATA!!!!!!!! ", graphData);

//   const combinedData = graphData?.plantoidInstance?.seeds.map(g => {
//     if (g.revealed && ipfsContent[g.id]) {
//       const revealedData = { ...g, ...ipfsContent[g.id] };
//       if (revealedData["animation_url"])
//         revealedData["revealed_uri"] = ipfsBase + revealedData["animation_url"].split("ipfs://")[1];
//       return revealedData;
//     }
//     if (!data) return { ...g };
//     const revealData = data?.plantoidMetadata?.seedMetadatas.find(s => s.id === g.id);
//     console.log("........................................\n");
//     console.log({ revealData });
//     if (revealData)
//       return {
//         ...g,
//         ...revealData,
//       };
//     else return { ...g };
//   });

//   const holderData = combinedData
//     ? combinedData.filter(g => g.holder.address.toLowerCase() === address.toLowerCase())
//     : [];
//   const remainData = combinedData
//     ? combinedData.filter(g => g.holder.address.toLowerCase() !== address.toLowerCase())
//     : [];

// console.log("ahahah", holderData)

const NFTDisplay = ({ address }) => {

  const contractAddress = '0x4073E38f71b2612580E9e381031B0c38B3B4C27E';
  const contractAddress2 = '0x0B60EE161d7b67fa231e9565dAFF65b34553bC6F';
  const [nfts, setNfts] = useState([]);

 
  
      
  //     useEffect(() => {
  //       const fetchNFTs = async () => {
  //         console.log("running fetchnfts");
  //         const web3 = new Web3(new Web3.providers.HttpProvider('https://goerli.infura.io/v3/cc7ca25d68f246f393d7630842360c47')); // Replace 'YOUR-PROJECT-ID' with your Infura Project ID
  //         const contract = new web3.eth.Contract(ABI, contractAddress2); // Replace contractAddress with your contract's address
  //         const pastEvents = await contract.getPastEvents('Transfer', {
  //            filter: {_from: '0x0000000000000000000000000000000000000000'},
  //           fromBlock: 0,
  //           toBlock: 'latest'
  //         });
  //         console.log(pastEvents);
       
  //         // let uniqueTokenIds = [...new Set(pastEvents.map(event => event.returnValues.tokenId))];
  //         // console.log(uniqueTokenIds);


  //     // let uniqueTokenIds = [...new Set(pastEvents.map(event => event.returnValues.tokenId))];
  //     // console.log(uniqueTokenIds);
      
  //     const totalSupply = pastEvents.length;      
  //     console.log(totalSupply);
      
  //     let tempNfts = [];

  //     // for (let i = 0; i < totalSupply; i++) {
  //       // reverse order:

  //       for (let i = totalSupply; i > 0; i--) {
  //       // let tokenId = i + 1;
  //           let tokenId = i;
        
  //       try {
  //         const tokenURI = await contract.methods.tokenURI(tokenId).call();
  //         let CID = tokenURI.replace('ipfs://', '');
  //         if (CID.startsWith(' ')) {
  //           CID = CID.substring(1);
  //         }
          
  //         console.log(CID);
  //         const metadata = await axios.get(`https://ipfs.io/ipfs/${CID}`);
  //         let animationUrl = metadata.data.animation_url;
  //         let reformattedAnimationUrl = animationUrl.replace('ipfs://', '');
  //         if (reformattedAnimationUrl.startsWith(' ')) {
  //           reformattedAnimationUrl = reformattedAnimationUrl.substring(1);
  //         }
          

  //         tempNfts.push(`https://ipfs.io/ipfs/${reformattedAnimationUrl}`);
  //       } catch (error) {
  //         console.error(`Failed to fetch metadata for token ${tokenId}: ${error}`);
  //       }
  //     }

  //     setNfts(tempNfts);
  //   };

  //   fetchNFTs();
  // }, [address]);


  useEffect(() => {

    const fetchNFTs = async () => {
        console.log("running fetchnfts");
        const tempNfts = [];
        graphData?.plantoidInstance?.seeds.forEach(g => {
          if (g.revealed && ipfsContent[g.id]) {
            const revealedData = { ...g, ...ipfsContent[g.id] };
            console.log(revealedData);
            if (revealedData["animation_url"]) {
              const reformattedAnimationUrl = revealedData["animation_url"].replace('ipfs://', '');
              tempNfts.push(`https://ipfs.io/ipfs/${reformattedAnimationUrl}`);
            }
          }
        });
        setNfts(tempNfts);
      };

      fetchNFTs();
    }, [address]);



  return (
    <div>
      <h1 className="gallery-title">Welcome to the gallery of Plantoid 15</h1>
      <p className="gallery-description">Here you can see all of its digital NFT seeds</p>
      <div className="nft-gallery">
        {nfts.map((nft, index) => (
          <div key={index} className="image-container">
            <video src={nft} alt="NFT" className="image" controls loop/>
            <p>Seed #{index + 1}</p>
          </div>
        ))}
      </div>
    </div>
  );
};



return (
  <div>
    {/* style={{ border: "1px solid #cccccc", padding: 16, width: 800, margin: "auto", marginTop: 64 }}> */}
    <h2>Plantoid #15</h2>
    <Divider />

Hello !

    {/* <Table
         dataSource={_.sortBy(holderData, function (o) {
          return -Number(o.tokenId);
        })}
        columns={revealColumns}
        rowKey="id"
    /> */}

<div className="App">
      <NFTDisplay address={address} />
      </div>
</div>


);
          }



}


