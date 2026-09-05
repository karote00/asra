# 官網手機圖片與 Google 服務實作報告

## 狀態

PR 修改位於獨立 worktree `.git/agent-worktrees/site-performance-analytics-pr`，分支
`codex/site-performance-analytics-pr`，PR 基底為 `origin/main`（`5032c7766`）。透過 PR 審查後合併至 main，再由既有 Git 整合部署；未直接部署正式站。

本次範圍為手機圖片載入、GA4 與 GSC 串接，以及必要的測試與操作說明。
沒有更換框架、圖片素材或版面幾何。

## 手機圖片

首頁四張圖片的 `sizes` 原本高估手機顯示尺寸，瀏覽器再乘上裝置像素倍率，
因此選用過大的圖片。修正後，320、390、412、520、680、800 CSS px 的
2 倍像素測試中，主圖均選用既有的 720 px 無損 WebP；520 px 以下另檢查
Grow、Same Path 與 One Source 圖片。各圖仍符合顯示寬度 2 倍的清晰度要求。

主圖由約 958 KiB 降至約 299 KiB，檔案大小減少約 69%。這是實際選用素材的
大小比較，不代表 LCP 或 Lighthouse 分數已有同等幅度改善。

修正前已證明新增正式測試會失敗：320 px 裝置預期 720 px 圖片，實際為
1400 px。修正後六個尺寸通過。正式建置的手機視覺、無 JavaScript、減少動態
效果與 Google 停用模式合計 11 項 E2E 通過，並檢視產出的手機截圖。

## GA4 與 GSC

Google 條款已經使用者當下授權接受，帳戶及串流建立成功：

| 項目 | 值 |
| --- | --- |
| GA4 帳戶 | Asyra，406998407 |
| GA4 資源 | Asyra Framework Website，552885321 |
| 網站串流 | 15724392131 |
| 評估 ID | `G-LGCR34S33S` |
| 時區／幣別 | 台灣／TWD |
| GSC 資源 | `https://asyra-framework.vercel.app/`，待驗證 |

GA4 僅在 Vercel Production 且設定有效 ID 時載入；Preview 與本機預設停用。
Google signals 與廣告個人化停用。頁面載入及 History 導覽由 GA4 加強型評估
負責，沒有另加一組手動 page_view。已啟用捲動、站外點擊及下載評估。

啟用模式的 E2E 已通過，檢查驗證標記、初始化與頁面切換，但測試攔截 Google
網路請求，避免傳送測試資料。GA4 首頁目前仍顯示尚未收到資料。

正式部署需設定 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 及 `GOOGLE_SITE_VERIFICATION`，
後者內容為 `m9uEIDRmynohVDgQI6DeirBCq4ZLdBoaVBzCCdVv9L0`。
這兩個值將公開出現在網站 HTML，不是登入憑證。
完整操作說明位於 `apps/asyra-framework-site/docs/google-services.md`。

## 驗證結果與限制

- 網站正式建置通過，相關 Google 設定及 CSP 單元測試通過。
- 本機正式建置的 46 個網站路由及 3 個探索入口檢查通過。
- 初始 worktree 的文件產物過期源於尚未合併的另一項開發；PR 改以 main 為基底，
  不納入那四份衍生 JSON 或另一位 Agent 的提交。
- 改以 main 為 PR 基底後，重新建置通過，全站單元測試為 69 通過、15 跳過、0 失敗。
  初始 worktree 的 `copy-style` 失敗不在這份 PR 基底中。
- 既有桌面／平板視覺測試在 Same Path 圖片像素密度失敗；864 px 案例已用
  未修正的首頁重現。1440、820 與 Retina 864 px 的相關測試未通過，沒有宣稱
  全部視覺測試為綠燈。桌面 `sizes` 未在本次改動範圍。

## 正式站待辦

1. 建立 PR；經審查合併至 main 後，由既有 Vercel Git 整合自動部署。不得直接部署功能分支至正式站。
2. 檢查正式站驗證標記與 CSP，完成 GSC 擁有權驗證並提交 sitemap。
3. 用 GA4 即時報表檢查實際頁面瀏覽、內部導覽與站外點擊。
4. 重跑手機與桌面 Lighthouse；部署前基準為 Performance 77／90、
   Accessibility 96／96、Best Practices 100／100、SEO 100／100。

SEO 100 只表示 Lighthouse 的技術檢查通過，不代表收錄或排名保證。

- <a href="https://pagespeed.web.dev/analysis/https-asyra-framework-vercel-app/2yk4o6mf84?form_factor=mobile" target="_blank" rel="noopener noreferrer">部署前 PageSpeed 報告</a>
- <a href="https://analytics.google.com/analytics/web/#/a406998407p552885321/reports/intelligenthome" target="_blank" rel="noopener noreferrer">GA4 資源首頁</a>
