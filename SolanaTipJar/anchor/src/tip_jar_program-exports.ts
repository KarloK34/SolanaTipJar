// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import TipJarProgramIDL from '../target/idl/tip_jar_program.json'
import type { TipJarProgram } from '../target/types/tip_jar_program'

// Re-export the generated IDL and type
export { TipJarProgram, TipJarProgramIDL }

// The programId is imported from the program IDL.
export const BASIC_PROGRAM_ID = new PublicKey(TipJarProgramIDL.address)

// This is a helper function to get the Basic Anchor program.
export function getTipJarProgram(provider: AnchorProvider, address?: PublicKey): Program<TipJarProgram> {
  return new Program(
    { ...TipJarProgramIDL, address: address ? address.toBase58() : TipJarProgramIDL.address } as TipJarProgram,
    provider,
  )
}

// This is a helper function to get the program ID for the Basic program depending on the cluster.
export function getTipJarProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Basic program on devnet and testnet.
      return BASIC_PROGRAM_ID
    case 'mainnet-beta':
    default:
      return BASIC_PROGRAM_ID
  }
}
