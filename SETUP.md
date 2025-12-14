# 🚀 Setup Instructions for Solana Tip Jar App

This guide will help you get the project up and running on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (version 18.0 or higher recommended)
  - Check your version: `node --version`
  - Download from: https://nodejs.org/
- **npm** (comes with Node.js)
  - Check your version: `npm --version`
- **Git** (for cloning the repository)
  - Check your version: `git --version`

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SolanaTipJar
```

### 2. Navigate to the Project Directory

The main project is located in the `SolanaTipJar` subdirectory:

```bash
cd SolanaTipJar
```

### 3. Install Dependencies

Install all required npm packages:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- Next.js 15.5.7
- React 19.1.1
- Solana Web3.js libraries
- Wallet adapter packages
- Tailwind CSS
- And all other project dependencies

**Note:** This may take a few minutes depending on your internet connection.

### 4. Start the Development Server

Once dependencies are installed, start the development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

You should see output similar to:
```
  ▲ Next.js 15.5.7
  - Local:        http://localhost:3000
  - Ready in X seconds
```

### 5. (Optional) For Testing with Wallets

To test the wallet connection functionality:

1. **Install a Solana Wallet Extension:**
   - **Phantom** (recommended): https://phantom.app/
   - **Solflare**: https://solflare.com/

2. **Switch to Devnet:**
   - Open your wallet extension
   - Go to Settings → Developer Mode (or Network Settings)
   - Switch to **Devnet** (not Mainnet!)

3. **Get Devnet SOL:**
   - Visit https://faucet.solana.com/
   - Paste your wallet address
   - Request an airdrop (you'll get free devnet SOL for testing)

4. **Connect Your Wallet:**
   - Open the app at http://localhost:3000
   - Click the "Select Wallet" button in the header
   - Choose your wallet (Phantom, Solflare, etc.)
   - Approve the connection

## Available Scripts

Once set up, you can use these npm scripts:

- `npm run dev` - Start the development server
- `npm run build` - Build the production version
- `npm run start` - Start the production server (after building)
- `npm run lint` - Run ESLint to check code quality
- `npm run format` - Format code using Prettier
- `npm run format:check` - Check if code is formatted correctly

## Troubleshooting

### Issue: `npm install` fails
- **Solution:** Make sure you have Node.js 18+ installed. Try deleting `node_modules` and `package-lock.json`, then run `npm install` again.

### Issue: Port 3000 is already in use
- **Solution:** Either stop the other application using port 3000, or run: `npm run dev -- -p 3001` to use a different port.

### Issue: Wallet connection doesn't work
- **Solution:** 
  - Make sure your wallet extension is installed and unlocked
  - Verify you're on Devnet in your wallet settings
  - Check that the app is running on http://localhost:3000 (not https)

### Issue: "Module not found" errors
- **Solution:** Run `npm install` again to ensure all dependencies are properly installed.

## Project Structure

```
SolanaTipJar/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   └── lib/              # Utility functions
├── anchor/               # Solana program (Anchor framework)
├── public/               # Static assets
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Next Steps

After setup is complete, you can:
- Start developing new features
- Review the `PROJECT_SPEC.md` for project requirements
- Check existing components in `src/components/`
- Explore the codebase structure

## Need Help?

If you encounter any issues not covered here:
1. Check the project's `README.md` in the `SolanaTipJar` directory
2. Review the `PROJECT_SPEC.md` for project details
3. Contact the project maintainer

---

**Happy coding! 🎉**
