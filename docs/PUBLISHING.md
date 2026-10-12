# GitHub OSS公開・リリース手順

GitHubでのソース公開と、ホストの公開プラグインディレクトリーへの申請は別の作業です。このガイドはGitHubの公開用ファイルを準備します。プラグインの掲載審査やブラウザー版ChatGPTへの接続は行いません。

## 公開前

1. READMEの対応範囲・未実装機能・ライセンスが現在の実装と一致するか確認します。
2. 下記のチェックを実行します。
3. `release/blend-studio-source/`だけを公開対象にします。開発用フォルダー全体をアップロードしないでください。
4. ロゴ、サンプル、スクリーンショットに第三者の私有モデルや個人情報が含まれないか確認します。
5. リポジトリ作成時にREADMEや別ライセンスを自動生成せず、用意したMITライセンスを使います。
6. GitHub側でprivate vulnerability reportingを有効化します。連絡先を用意する場合はSECURITY.mdを更新します。

```sh
npm ci
npm run build
npm test
npm run package
npm run export:source
npm run check:public
```

`package`と`export:source`は、それぞれの生成先を再作成します。`release/`には手作業のファイルを保存しないでください。CIの成功を主張する前に、実際のGitHub Actions結果を確認します。用意したworkflowはテストのみで、公開・デプロイは行いません。

公開時の紹介文例:

> Local Blend/GLB/VRM viewer with PBR/MToon rendering and surface-point context for MCP Apps chat.

候補のトピック: `mcp`, `mcp-apps`, `blender`, `gltf`, `vrm`, `mtoon`, `threejs`。

## 初回公開の位置付け

現状はexperimental / early previewとして公開するのが適切です。Windowsの導入とローカル表示は確認していますが、ホストごとの表示差、macOS/Linux、圧縮形式には未検証・未対応部分があります。Blenderライブ編集とTripo生成は予定として明記します。

MITは既存のプロジェクトライセンスです。元の著作権表示を残してください。依存コードはTHIRD_PARTY_NOTICES.md、同梱スキーマはschemas/LICENSEに従います。モデルを読み込めることは、そのモデルの再配布権を与えません。

## ビルド済みリリース

`release/blend-studio/`を**フォルダーごと**ZIP化します。ZIP内の最上位は`blend-studio`とし、その下にCMD、PS1、manifest、dist、serverなどを入れます。

| 配布物 | 用途 |
|---|---|
| `Blend-Studio-<version>.zip` | ビルド済み。Node.jsは必要、npm installは不要 |
| GitHubのSource code ZIP / clean source ZIP | 開発用。npm ciとビルドが必要 |
| `release/blend-studio-manifest.json` | ファイル一覧、サイズ、SHA-256 |

Releases本文に、実際に確認したOS/Node/Blender/ホストのバージョン、既知の制約、ZIPのSHA-256を記載します。同じバージョンの配布物を差し替えるより、版を上げて変更履歴を更新してください。Windowsで最終ZIPを展開してインストーラーを確認します。

この手順でファイルを準備するだけでは、GitHubへのpush、リポジトリ作成、Releases公開は行われません。

参考: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)、[GitHubのprivate vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository)。
