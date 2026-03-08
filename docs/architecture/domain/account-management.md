# Account Management - Domain Architecture

## Overview

YourApp's account management system provides users with comprehensive control over their profile, subscription, usage statistics, calculator access, and order history. The account page is the central hub for all user-facing features.

**Key Features:**
- **Profile Management:** Edit name, email, phone, address, notes
- **Subscription Management:** View current plan, upgrade/downgrade, billing portal
- **Usage Dashboard:** Real-time calculator usage and limits
- **Calculator Interface:** Access to financial calculators
- **Order History:** View past one-time purchases

---

## Table of Contents

1. [Account Page Structure](#account-page-structure)
2. [Profile Editor](#profile-editor)
3. [Subscription Management](#subscription-management)
4. [Usage Dashboard](#usage-dashboard)
5. [Calculator Interface](#calculator-interface)
6. [Best Practices](#best-practices)

---

## Account Page Structure

### Main Account Page

**Location:** `app/(customer)/(main)/account/page.tsx`

```typescript
'use client';

import { useApp } from '@/shared/contexts/app-context';
import { AuthGuard } from '@/features/auth/components/auth-guard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ProfileEditor } from '@/features/account/components/profile-editor';
import { SubscriptionManagement } from '@/features/account/components/subscription-management';
import { UsageDashboard } from '@/features/account/components/usage-dashboard';
import { CalculatorInterface } from '@/features/account/components/calculator-interface';

export default function AccountPage() {
  const { user } = useApp();

  return (
    <AuthGuard requireAuth>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>
        
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileEditor />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionManagement />
          </TabsContent>

          <TabsContent value="usage">
            <UsageDashboard />
          </TabsContent>

          <TabsContent value="calculator">
            <CalculatorInterface />
          </TabsContent>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
```

---

## Profile Editor

### Overview

The Profile Editor allows users to update their personal information, including name, email, phone, address, and notes.

**Location:** `features/account/components/profile-editor.tsx`

### Key Features

- **OAuth Detection:** Email field is disabled for Google/OAuth users
- **Real-time Validation:** Form validation on input
- **Optimistic Updates:** Immediate feedback on save
- **Privacy Notice:** Clear information about data security

### API Integration

**GET /api/customer/profile:**

```typescript
const fetchProfile = async () => {
  const data = await authenticatedFetchJson('/api/customer/profile');
  // Response: { profile: Profile, isOAuthUser: boolean }
  setProfile(data.profile);
  setIsOAuthUser(data.isOAuthUser);
};
```

**PUT /api/customer/profile:**

```typescript
const handleSave = async () => {
  const requestData: any = {
    name: formData.name,
    phone: formData.phone,
    address: formData.address,
    notes: formData.notes || null,
  };

  // Only include email for non-OAuth users
  if (!isOAuthUser) {
    requestData.email = formData.email;
  }

  const data = await authenticatedFetchJson('/api/customer/profile', {
    method: 'PUT',
    body: JSON.stringify(requestData),
  });

  toast.success('Profile updated successfully!');
};
```

### Form Fields

```typescript
interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## Subscription Management

### Overview

The Subscription Management component displays the user's current subscription tier, usage statistics, plan features, and billing actions.

**Location:** `features/account/components/subscription-management.tsx`

### Key Features

- **Current Plan Display:** Tier, price, billing cycle
- **Usage Meter:** Visual progress bar for calculator usage
- **Plan Features:** List of features included in current tier
- **Upgrade/Downgrade:** Links to pricing page
- **Stripe Portal:** Manage subscription via Stripe Customer Portal

### Current Plan Card

```typescript
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          Current Plan
          <Badge variant="default">Active</Badge>
        </CardTitle>
        <CardDescription>
          {tierConfig.name} Plan - ${tierConfig.price}/{tierConfig.billingCycle}
        </CardDescription>
      </div>
      <Button variant="outline" asChild>
        <Link href="/pricing">Change Plan</Link>
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-sm text-muted-foreground">Billing Cycle</p>
        <p className="text-lg font-semibold capitalize">{tierConfig.billingCycle}</p>
      </div>
      {usageStats?.resetDate && (
        <div>
          <p className="text-sm text-muted-foreground">Next Billing Date</p>
          <p className="text-lg font-semibold">
            {new Date(usageStats.resetDate).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

### Usage Statistics

```typescript
const [usageStats, setUsageStats] = useState<{
  currentUsage: number;
  usageLimit: number | null;
  percentageUsed: number;
  limitReached?: boolean;
  resetDate?: string;
} | null>(null);

useEffect(() => {
  const loadUsageData = async () => {
    const usage = await authenticatedFetchJson('/api/calculator/usage');
    setUsageStats(usage);
  };
  loadUsageData();
}, [user]);

// Display usage
{usageStats.usageLimit !== null && (
  <>
    <Progress value={usageStats.percentageUsed} className="h-2" />
    <div className="flex items-center justify-between text-sm">
      <span>{usageStats.percentageUsed}% used</span>
      <span>Resets on {new Date(usageStats.resetDate).toLocaleDateString()}</span>
    </div>
  </>
)}
```

### Stripe Customer Portal

```typescript
<ManageSubscriptionButton className="flex-1">
  Manage Subscription
</ManageSubscriptionButton>

// ManageSubscriptionButton creates portal session and redirects
```

---

## Usage Dashboard

### Overview

The Usage Dashboard shows detailed calculator usage history and statistics.

**Location:** `features/account/components/usage-dashboard.tsx`

### Key Features

- **Usage Summary:** Total calculations this month
- **History Table:** Past calculations with timestamps
- **Export Options:** Download usage data (tier-dependent)
- **Visual Analytics:** Charts and graphs for usage trends

### Usage History Table

```typescript
interface CalculatorUsageRecord {
  id: string;
  calculationType: 'mortgage' | 'loan' | 'investment' | 'retirement';
  createdAt: Date;
  calculationTime: number; // milliseconds
}

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Type</TableHead>
      <TableHead>Date</TableHead>
      <TableHead>Time</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {history.map(record => (
      <TableRow key={record.id}>
        <TableCell className="capitalize">{record.calculationType}</TableCell>
        <TableCell>{new Date(record.createdAt).toLocaleDateString()}</TableCell>
        <TableCell>{record.calculationTime}ms</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## Calculator Interface

### Overview

The Calculator Interface provides direct access to financial calculators from the account page, with feature gating based on subscription tier.

**Location:** `features/account/components/calculator-interface.tsx`

### Calculator Selection

```typescript
const calculators = [
  { type: 'mortgage', name: 'Mortgage Calculator', tier: 'basic' },
  { type: 'loan', name: 'Loan Calculator', tier: 'basic' },
  { type: 'investment', name: 'Investment Calculator', tier: 'pro' },
  { type: 'retirement', name: 'Retirement Calculator', tier: 'enterprise' },
];

<div className="grid gap-6 md:grid-cols-2">
  {calculators.map(calc => (
    <FeatureGate
      key={calc.type}
      requiredTier={calc.tier}
      fallback={
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>{calc.name}</CardTitle>
            <CardDescription>
              Requires {calc.tier} plan or higher
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/pricing">Upgrade to Unlock</Link>
            </Button>
          </CardContent>
        </Card>
      }
    >
      <CalculatorCard type={calc.type} name={calc.name} />
    </FeatureGate>
  ))}
</div>
```

### Calculator Component

```typescript
function CalculatorCard({ type, name }: { type: string; name: string }) {
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    
    const response = await authenticatedFetchJson('/api/calculator/calculate', {
      method: 'POST',
      body: JSON.stringify({ type, inputs }),
    });

    setResults(response.results);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Input fields based on calculator type */}
        <Button onClick={handleCalculate} disabled={loading}>
          {loading ? 'Calculating...' : 'Calculate'}
        </Button>
        
        {results && <ResultsDisplay results={results} />}
      </CardContent>
    </Card>
  );
}
```

---

## Best Practices

### 1. Always Use AuthGuard

```typescript
// ✅ CORRECT: Wrap account pages with AuthGuard
export default function AccountPage() {
  return (
    <AuthGuard requireAuth>
      <AccountContent />
    </AuthGuard>
  );
}

// ❌ WRONG: No authentication check
export default function AccountPage() {
  return <AccountContent />;
}
```

### 2. Handle OAuth Users Differently

```typescript
// ✅ CORRECT: Disable email for OAuth users
<Input
  id="email"
  value={formData.email}
  onChange={(e) => handleInputChange("email", e.target.value)}
  disabled={isOAuthUser}
/>
<p className="text-xs text-muted-foreground">
  {isOAuthUser 
    ? "Email cannot be changed for Google/OAuth accounts"
    : "Changing your email will update your login credentials"
  }
</p>

// ❌ WRONG: Allow email change for OAuth users
<Input id="email" value={formData.email} onChange={...} />
```

### 3. Show Loading States

```typescript
// ✅ CORRECT: Show loading skeleton
if (loading) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4">Loading profile...</p>
      </CardContent>
    </Card>
  );
}

// ❌ WRONG: Blank screen while loading
if (loading) return null;
```

### 4. Provide Clear Feedback

```typescript
// ✅ CORRECT: Toast notifications + inline success
await authenticatedFetchJson('/api/customer/profile', {
  method: 'PUT',
  body: JSON.stringify(requestData),
});

setSuccess(true);
toast.success('Profile updated successfully!');

// Clear success after 3 seconds
setTimeout(() => setSuccess(false), 3000);

// ❌ WRONG: Silent update
await authenticatedFetchJson('/api/customer/profile', { method: 'PUT', body });
```

### 5. Use Feature Gating for Calculators

```typescript
// ✅ CORRECT: Feature gate with upgrade path
<FeatureGate
  requiredTier="pro"
  fallback={
    <Card className="opacity-50">
      <CardHeader>
        <CardTitle>Investment Calculator</CardTitle>
        <CardDescription>Requires Pro plan or higher</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/pricing">Upgrade to Pro</Link>
        </Button>
      </CardContent>
    </Card>
  }
>
  <InvestmentCalculator />
</FeatureGate>

// ❌ WRONG: Hide feature without explanation
{hasProAccess && <InvestmentCalculator />}
```

---

## Related Documentation

- [Profile Management](../core/authentication-system.md)
- [Subscription Management](./subscription-architecture.md)
- [Calculator Interface](./calculator-system.md)
- [Usage Tracking](./usage-tracking.md)

---

*Last Updated: December 2025*

