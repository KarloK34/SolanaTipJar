use anchor_lang::prelude::*;

declare_id!("FF5Z4788Lg36hMGnYVuM6xUvtkCLGzRc7duPbfW537js");

#[program]
pub mod tip_jar_program {
    use super::*;

    pub fn create_tip_jar(
        ctx: Context<CreateTipJar>,
        name: String,
        description: String,
    ) -> Result<()> {
        let tip_jar = &mut ctx.accounts.tip_jar;

        tip_jar.owner = ctx.accounts.user.key(); // ← OVO JE POVEZNICA
        tip_jar.name = name;
        tip_jar.description = description;
        tip_jar.created_at = Clock::get()?.unix_timestamp;
        tip_jar.bump = ctx.bumps.tip_jar;

        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.tip_jar.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.tip_jar.to_account_info(),
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
                + 4 + 50   // String name
                + 4 + 200  // String description
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

    pub system_program: Program<'info, System>,
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
}
