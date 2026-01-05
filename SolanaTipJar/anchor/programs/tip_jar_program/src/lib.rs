use anchor_lang::prelude::*;

declare_id!("EhoANy4H2iyrU49xLvyKzBcvbwkfhEURLeYMrbse8RTo");

// Constants defined at module level
// NOTE: Update your Anchor.toml with:
// [toolchain]
// anchor_version = "0.31.1"

const FEE_PERCENTAGE: u64 = 10; // 10%
const NAME_MAX: usize = 100;
const DESC_MAX: usize = 500;

#[program]
pub mod tip_jar_program {
    use super::*;

    pub fn create_tip_jar(
        ctx: Context<CreateTipJar>,
        name: String,
        description: String,
    ) -> Result<()> {
        let tip_jar = &mut ctx.accounts.tip_jar;

        tip_jar.owner = ctx.accounts.user.key();
        tip_jar.name = name;
        tip_jar.description = description;
        tip_jar.created_at = Clock::get()?.unix_timestamp;
        tip_jar.bump = ctx.bumps.tip_jar;

        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        // Calculate fee (10% of donation)
        let fee_amount = amount.checked_mul(FEE_PERCENTAGE)
            .ok_or(CustomError::CalculationOverflow)?
            .checked_div(100)
            .ok_or(CustomError::CalculationOverflow)?;
        
        let tip_amount = amount.checked_sub(fee_amount)
            .ok_or(CustomError::CalculationOverflow)?;

        // Transfer fee to fee account
        let fee_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.fee_account.key(),
            fee_amount,
        );

        anchor_lang::solana_program::program::invoke(
            &fee_ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.fee_account.to_account_info(),
            ],
        )?;

        // Transfer remaining amount to tip jar
        let tip_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.tip_jar.key(),
            tip_amount,
        );

        anchor_lang::solana_program::program::invoke(
            &tip_ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.tip_jar.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn donate_token(ctx: Context<DonateToken>, amount: u64) -> Result<()> {
        // Manually read token account fields to support both standard Token and Token-2022
        // TokenAccount structure: mint (32 bytes) + owner (32 bytes) + ...
        // We only need to verify mint and owner, so we read them directly from the account data
        
        fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
            if data.len() < offset + 32 {
                return Err(Error::from(CustomError::Unauthorized));
            }
            Pubkey::try_from(&data[offset..offset + 32])
                .map_err(|_| Error::from(CustomError::Unauthorized))
        }

        // Read and verify token accounts, then drop the borrows before CPI calls
        let (_donor_mint, _donor_owner, _fee_mint, _tip_jar_mint) = {
            let donor_data = ctx.accounts.donor_token_account.data.borrow();
            let fee_data = ctx.accounts.fee_token_account.data.borrow();
            let tip_jar_data = ctx.accounts.tip_jar_token_account.data.borrow();

            // Read mint (offset 0) and owner (offset 32) from each token account
            let _donor_mint = read_pubkey(&donor_data, 0)?;
            let _donor_owner = read_pubkey(&donor_data, 32)?;
            let _fee_mint = read_pubkey(&fee_data, 0)?;
            let _tip_jar_mint = read_pubkey(&tip_jar_data, 0)?;

            // Verify token accounts
            require!(
                _donor_owner == ctx.accounts.donor.key(),
                CustomError::Unauthorized
            );
            require!(
                _donor_mint == ctx.accounts.mint.key(),
                CustomError::Unauthorized
            );
            require!(
                _fee_mint == ctx.accounts.mint.key(),
                CustomError::Unauthorized
            );
            require!(
                _tip_jar_mint == ctx.accounts.mint.key(),
                CustomError::Unauthorized
            );

            // Borrows are dropped here when we exit the scope
            (_donor_mint, _donor_owner, _fee_mint, _tip_jar_mint)
        };

        // Calculate fee (10% of donation)
        let fee_amount = amount.checked_mul(FEE_PERCENTAGE)
            .ok_or(CustomError::CalculationOverflow)?
            .checked_div(100)
            .ok_or(CustomError::CalculationOverflow)?;
        
        let tip_amount = amount.checked_sub(fee_amount)
            .ok_or(CustomError::CalculationOverflow)?;

        // Build transfer instruction manually to support both Token and Token-2022
        // Transfer instruction format: [instruction_discriminator (1 byte), amount (8 bytes)]
        let mut transfer_data = Vec::with_capacity(9);
        transfer_data.push(3); // Transfer instruction discriminator
        transfer_data.extend_from_slice(&fee_amount.to_le_bytes());

        // Transfer fee to fee token account
        let fee_transfer_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.token_program.key(),
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    ctx.accounts.donor_token_account.key(),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    ctx.accounts.fee_token_account.key(),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    ctx.accounts.donor.key(),
                    true,
                ),
            ],
            data: transfer_data,
        };

        anchor_lang::solana_program::program::invoke(
            &fee_transfer_ix,
            &[
                ctx.accounts.donor_token_account.to_account_info(),
                ctx.accounts.fee_token_account.to_account_info(),
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;

        // Build transfer instruction for tip amount
        let mut tip_transfer_data = Vec::with_capacity(9);
        tip_transfer_data.push(3); // Transfer instruction discriminator
        tip_transfer_data.extend_from_slice(&tip_amount.to_le_bytes());

        // Transfer remaining amount to tip jar token account
        let tip_transfer_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.token_program.key(),
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    ctx.accounts.donor_token_account.key(),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    ctx.accounts.tip_jar_token_account.key(),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    ctx.accounts.donor.key(),
                    true,
                ),
            ],
            data: tip_transfer_data,
        };

        anchor_lang::solana_program::program::invoke(
            &tip_transfer_ix,
            &[
                ctx.accounts.donor_token_account.to_account_info(),
                ctx.accounts.tip_jar_token_account.to_account_info(),
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.user.key() == ctx.accounts.tip_jar.owner,
            CustomError::Unauthorized
        );

        let lamports_in_account = ctx.accounts.tip_jar.to_account_info().lamports();
        let rent_exempt =
            Rent::get()?.minimum_balance(ctx.accounts.tip_jar.to_account_info().data_len());
        let withdraw_amount = std::cmp::min(amount, lamports_in_account - rent_exempt);

        **ctx
            .accounts
            .tip_jar
            .to_account_info()
            .try_borrow_mut_lamports()? -= withdraw_amount;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += withdraw_amount;

        Ok(())
    }

    pub fn delete(ctx: Context<DeleteTipJar>) -> Result<()> {
        msg!("Delete user account");

        require!(
            ctx.accounts.user.key() == ctx.accounts.tip_jar.owner,
            CustomError::Unauthorized
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTipJar<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"tipjar", user.key().as_ref()],
        bump,
        space = 8  // discriminator
                + 32   // Pubkey owner
                + 4 + NAME_MAX   // String name
                + 4 + DESC_MAX  // String description
                + 8    // i64
                + 1 
    )]
    pub tip_jar: Account<'info, TipJar>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(mut)]
    pub tip_jar: Account<'info, TipJar>,

    /// CHECK: Fee account - hardcoded address
    #[account(mut, address = pubkey!("GgbVs9nBVxwNKFK6ipf64fV5ALcbAkd3asCM7dcbpYPd"))]
    pub fee_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DonateToken<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(mut)]
    pub tip_jar: Account<'info, TipJar>,

    /// CHECK: Mint address for the token
    pub mint: AccountInfo<'info>,

    /// CHECK: Donor token account (can be standard Token or Token-2022)
    #[account(mut)]
    pub donor_token_account: AccountInfo<'info>,

    /// CHECK: Fee token account (ATA for fee account, can be standard Token or Token-2022)
    #[account(mut)]
    pub fee_token_account: AccountInfo<'info>,

    /// CHECK: Tip jar token account (ATA for tip jar PDA, can be standard Token or Token-2022)
    #[account(mut)]
    pub tip_jar_token_account: AccountInfo<'info>,

    /// CHECK: Token program (can be either standard Token or Token-2022)
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tipjar", user.key().as_ref()],
        bump = tip_jar.bump,
    )]
    pub tip_jar: Account<'info, TipJar>,
}

#[derive(Accounts)]
pub struct DeleteTipJar<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user,
        seeds = [b"tipjar", user.key().as_ref()], 
        bump = tip_jar.bump
    )]
    pub tip_jar: Account<'info, TipJar>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct TipJar {
    pub owner: Pubkey,
    pub name: String,
    pub description: String,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized: only the owner can perform this action")]
    Unauthorized,
    #[msg("Calculation overflow occurred")]
    CalculationOverflow,
}