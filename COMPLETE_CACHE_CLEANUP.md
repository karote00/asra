# Complete Cache Cleanup Steps

When the code changes but the visuals do not, clear all of the caches below.

## Step 1: Stop the Development Server

```bash
# Find and stop all Node processes
pkill -f "yarn|node|vite"
sleep 2
```

## Step 2: Clear Build Caches

```bash
cd /Users/asa/Desktop/workspace/asra

# Remove all compiled dist folders
rm -rf packages/*/dist
rm -rf apps/*/dist
rm -rf .turbo/turbo-build-*.log

# Remove TypeScript caches
find . -name "*.tsbuildinfo" -delete

# Remove cached @asyra packages from node_modules
rm -rf node_modules/@asyra
```

## Step 3: Clear Browser Cache

### Option A: Hard Refresh (`Cmd+Shift+R` on macOS)

- Enable `Disable cache (while DevTools is open)` in the browser devtools.

### Option B: Fully Clear Local Storage

```javascript
// Run in the browser console:
localStorage.clear()
sessionStorage.clear()
// Then refresh the page (`Cmd+R`)
```

## Step 4: Reinstall Dependencies

```bash
yarn install
```

## Step 5: Rebuild

```bash
# Install dependencies and rebuild
yarn workspace @asyra/preset build:preset
```

## Step 6: Restart the Development Server

```bash
# Start the development server in a new terminal
yarn workspace @asyra/design dev
```

## Step 7: Re-test in a Fresh Browser Tab

1. Open `http://localhost:5173` or your app URL.
2. Open the design editor.
3. Select the triangle vector.
4. Change a stroke setting, for example the dash length.
5. Confirm that the dashed stroke updates correctly.

---

## Verification Checklist

After the cleanup, verify the following:

- [ ] Dash length is now about `30px` instead of `15px`
- [ ] Dashes align with the curve without a `2-3px` offset
- [ ] Dashes flow smoothly along the bezier curve
- [ ] Curve endpoints are smooth instead of jagged triangles
- [ ] Changing dash/gap settings updates immediately

---

## If Nothing Still Changes

If the visuals still do not change after the steps above, it usually means:

1. Some old code path is still being used at runtime.
2. The code path needs deeper auditing.

Record the result after the cleanup before moving on to further debugging.
