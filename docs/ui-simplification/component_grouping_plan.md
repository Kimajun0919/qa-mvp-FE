# Step 3. Component Grouping Plan

## 그룹 재배치
1. **Entry Group**
   - baseUrlInput
   - oneClickBtn (primary)
   - analyzeBtn (advanced secondary)

2. **Advanced Control Group (접힘)**
   - llmProviders, llmModel
   - setApiBaseBtn, testApiBtn
   - openaiAuthMode, openaiCredential, oauth* 버튼
   - endpointHealthPanel

3. **Checklist Auth Advanced Group (접힘)**
   - adminBaseUrl, authLoginUrl, authUserId, authPassword, autoUserSignup

4. **Result Consumption Group**
   - openHtml/openJson/openFixCsv/openFixXlsx/copyTsv

## 유지 원칙
- ID/이벤트 바인딩 불변
- 기존 API payload 구조 불변
- 단순 모드 동작 유지
