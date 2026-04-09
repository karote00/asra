# 完整快取清理步驟

當代碼改變後，但視覺上沒有變化時，需要清除以下所有快取：

## 步驟 1: 殺死開發伺服器

```bash
# 找到所有 Node 進程並殺死
pkill -f "yarn\|node\|vite"
sleep 2
```

## 步驟 2: 清除編譯快取

```bash
cd /Users/asa/Desktop/workspace/asra

# 清除所有編譯的 dist 文件夾
rm -rf packages/*/dist
rm -rf apps/*/dist
rm -rf .turbo/turbo-build-*.log

# 清除 TypeScript 快取
find . -name "*.tsbuildinfo" -delete

# 清除 node_modules 中的 @asyra 快取
rm -rf node_modules/@asyra
```

## 步驟 3: 清除瀏覽器快取

### 選項 A: 硬刷新 (Cmd+Shift+R on Mac)
- 在瀏覽器開發工具中選中 "Disable cache (while DevTools is open)"

### 選項 B: 完全清除本地存儲
```javascript
// 在瀏覽器控制台中執行：
localStorage.clear()
sessionStorage.clear()
// 然後重新整理頁面 (Cmd+R)
```

## 步驟 4: 重新安裝依賴

```bash
yarn install
```

## 步驟 5: 重新構建

```bash
# 設定依賴並編譯
yarn workspace @asyra/preset build:preset
```

## 步驟 6: 重啟開發伺服器

```bash
# 在新終端中啟動開發伺服器
yarn workspace @asyra/design dev
```

## 步驟 7: 在新瀏覽器標籤中測試

1. 打開 http://localhost:5173 (或你的應用 URL)
2. 打開設計編輯器
3. 選擇三角形向量
4. 改變 stroke 設定 (e.g., dash 長度)
5. **觀察 dash stroke 是否正確更新**

---

## 驗證點檢表

完成後，確認以下幾點：

- [ ] Dash 長度現在是 ~30px (不是 ~15px)
- [ ] Dash 與曲線完美對齐 (沒有 2-3px 偏移)
- [ ] Dash 沿著 bezier 曲線平順流動
- [ ] 曲線端點是光滑的 (不是粗糙的三角形)
- [ ] 改變 dash/gap 設定時立即看到更新

---

## 如果仍然沒有變化

如果完成以上步驟後仍然沒有變化，說明：
1. 代號流程中仍有舊代碼被使用
2. 需要進一步的代碼審計

請讓我知道清理後的結果！
