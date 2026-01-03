
# Commentary-of-Go  
一个围棋局势分析和解说生成系统  

## 分支介绍  
项目共维护以下 5 个分支：  

1. **`main` 分支**：默认分支，代表已发布的稳定版本。  
2. **`develop` 分支**：开发主干分支，用于集成所有功能模块。  
3. **`feature/*` 分支**：功能开发分支，按模块分工如下：  
   - `feature/SIR`：由王昶欢负责  
   - `feature/frontend`：由张栋良负责  
   - `feature/chess_piece_matching`：由金进壕负责  

> 💡 所有功能开发必须在对应的 `feature/xxx` 分支上进行，禁止直接修改 `main` 或 `develop`。

## Pull Request（PR）提交流程  

为保证代码质量和协作规范，所有功能合并必须通过 Pull Request。流程如下：  

### 1. 本地开发完成  
在自己的 `feature/xxx` 分支完成编码、测试与文档更新。

### 2. 同步最新 `develop` 分支（避免冲突）  
```bash
git checkout develop
git pull origin develop
git checkout feature/your-branch
git rebase develop
```

### 3. 推送分支到 GitHub  
```bash
git push -u origin feature/your-branch
```

### 4. 创建 Pull Request  
- **Base branch**: `develop`  
- **Compare branch**: 你的 `feature/xxx`  
- **标题格式**: `feat: 简要描述功能`（例如：`feat: 实现SIR模块核心逻辑`）  
- **正文内容建议包含**:  
  - 功能说明  
  - 测试方法  
  - 是否存在已知问题或需特别注意的点  

### 5. 等待审查  
- 至少 **1 名协作者批准** 后方可合并  
- 所有评论必须 **回复或标记为 resolved**  

### 6. 合并与清理  
- 审查通过后，使用 **“Merge”** 或 **“Squash and merge”** 合并  
- 合并成功后，**删除已完工的 `feature/xxx` 分支**（保持仓库整洁）  

> ⚠️ **重要规则**  
> - 严禁直接向 `main` 或 `develop` 推送代码  
> - 紧急修复请创建 `hotfix/xxx` 分支，并走相同 PR 流程




