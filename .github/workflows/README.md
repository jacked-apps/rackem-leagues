# GitHub Actions CI/CD Setup

This repository uses GitHub Actions to automatically deploy the application to staging and production environments.

## Workflows

### 1. Deploy to Staging (`deploy-staging.yml`)
- **Trigger**: Automatic deployment when PRs are merged to `main` branch
- **Environment**: `staging`
- **Actions**:
  - Builds the Vite application
  - Runs Supabase database migrations
  - Deploys to S3
  - Invalidates CloudFront cache

### 2. Deploy to Production (`deploy-production.yml`)
- **Trigger**: Automatic deployment when a semantic version tag is pushed (e.g., `v1.0.0`, `v0.1.5`)
- **Environment**: `production`
- **Actions**:
  - Builds the Vite application
  - Runs Supabase database migrations
  - Deploys to S3
  - Invalidates CloudFront cache
  - Creates a GitHub Release

## Required GitHub Secrets

You need to configure the following secrets for both `staging` and `production` environments in your GitHub repository settings:

### Supabase Secrets
- `SUPABASE_ACCESS_TOKEN` - Your Supabase access token (get from Supabase dashboard → Account → Access Tokens). Repo-level secret, shared by both envs.
- `SUPABASE_DB_PASSWORD` - Your Supabase database password
- `SUPABASE_PROJECT_ID` - Your Supabase project reference ID (e.g., `abcdefghijklmnop`)
- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://abcdefghijklmnop.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key (get from Supabase dashboard → Settings → API)

### AWS Secrets
- `AWS_ACCESS_KEY_ID` - AWS IAM access key with S3 and CloudFront permissions
- `AWS_SECRET_ACCESS_KEY` - AWS IAM secret access key
- `AWS_REGION` - AWS region where your S3 bucket is located (e.g., `us-east-1`)
- `S3_BUCKET` - S3 bucket name for static hosting
- `CLOUDFRONT_DISTRIBUTION_ID` - CloudFront distribution ID for cache invalidation

## AWS IAM Permissions

The AWS IAM user needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
    }
  ]
}
```

## Usage

### Deploying to Staging
1. Create a pull request with your changes
2. Merge the PR to `main` branch
3. The staging deployment will automatically trigger
4. Monitor the deployment in the "Actions" tab

### Deploying to Production
1. Ensure `main` branch has the code you want to release
2. Create and push a semantic version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The production workflow triggers and **pauses** at the Required Reviewers gate on the `production` environment
4. Approve the run in the Actions UI; migrations apply, frontend deploys, GitHub Release is created

### Manually triggering a production deploy (no tag)
The `deploy-production.yml` workflow also supports `workflow_dispatch` for emergency redeploys or pre-launch smoke tests. From Actions → "Deploy to Production" → "Run workflow", select a ref and type `deploy` in the confirm input. The run still requires Required Reviewers approval and does not create a GitHub Release (only tag-triggered runs do).

## Deployment Features

### Smart Caching
The workflow sets appropriate cache headers:
- **Static assets** (JS, CSS, images): `max-age=31536000, immutable` (1 year)
- **HTML files**: `max-age=0, must-revalidate` (always check for updates)

### Supabase Migrations
Migrations in `supabase/migrations/` are automatically applied to the database during deployment using `supabase db push`.

### Build Optimization
- Uses pnpm for fast, efficient dependency installation
- Caches pnpm store for faster subsequent builds
- Runs TypeScript compilation before Vite build

## Troubleshooting

### Failed Supabase Migrations
If migrations fail, check:
- `SUPABASE_PROJECT_ID` is correct
- `SUPABASE_API_KEY` has sufficient permissions
- Migration SQL is valid

### Failed AWS Deployment
If S3 or CloudFront deployment fails, check:
- AWS credentials have correct permissions
- S3 bucket exists and is accessible
- CloudFront distribution ID is correct
- `AWS_REGION` matches your bucket's region

### Failed Build
If the build fails, check:
- All dependencies are listed in `package.json`
- TypeScript compilation passes locally
- No environment-specific code that requires runtime secrets

## Security Notes

- Never commit sensitive keys to the repository. Always use GitHub Secrets.
- The `VITE_SUPABASE_ANON_KEY` is safe to expose in the built application (it's the public anonymous key).
- Use Supabase Row Level Security (RLS) policies to protect your data, not secret keys.
- The workflows automatically inject environment variables at build time.

