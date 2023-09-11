import React, { useEffect, useState } from "react";


import _ from "lodash";

// import '../themes/NFTDisplay.css'; // Assuming you have a CSS file for styling

const dotenv = require("dotenv");

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
    console.log(process.env);
    console.log(dotenv.config().parsed);
  }

  const contractAddress = "0x4073E38f71b2612580E9e381031B0c38B3B4C27E";
  const contractAddress2 = "0x0B60EE161d7b67fa231e9565dAFF65b34553bC6F";
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    const fetchNFTs = async () => {
      console.log("running fetchnfts");
      const tempNfts = [];
      graphData?.plantoidInstance?.seeds.forEach(g => {
        if (g.revealed && ipfsContent[g.id]) {
          const revealedData = { ...g, ...ipfsContent[g.id] };
          console.log(revealedData);
          if (revealedData["animation_url"]) {
            const reformattedAnimationUrl = revealedData["animation_url"].replace("ipfs://", "");
            tempNfts.push(`https://ipfs.io/ipfs/${reformattedAnimationUrl}`);
          }
        }
      });
      setNfts(tempNfts);
    };

    fetchNFTs();
  }, [graphData]);

  return (
    <div>
      <h1 className="gallery-title">Welcome to the gallery of Plantoid 15</h1>
      <p className="gallery-description">Here you can see all of its digital NFT seeds</p>
      <div className="nft-gallery">
        {nfts.map((nft, index) => (
          <div key={index} className="image-container">
            <video src={nft} alt="NFT" className="image" controls loop />
            <p>Seed #{index + 1}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
