<img src="assets/logo.svg" width="64" height="64" alt="Blend Studio icon">

# Blend Studio

**3Dモデルを見ながら、修正したい場所をチャットに伝える。**

[English](README.en.md) · [Releases](https://github.com/Maguro-Tsukiji/blend-studio/releases) · [導入手順](docs/INSTALLATION.md) · [開発参加](CONTRIBUTING.md) · [変更履歴](CHANGELOG.md)

[![Build and test](https://github.com/Maguro-Tsukiji/blend-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Maguro-Tsukiji/blend-studio/actions/workflows/ci.yml)

Blend Studioは、`.blend`・`.glb`・`.vrm`を表示するローカルMCP Apps／OpenAI MCP Extensionsプラグインです。PBR・MToonの描画、部位・マテリアルの選択、モデル表面への位置指定に対応しています。

モデルに①の印を付けて、ホストのチャットで「①の毛先を短くして」と依頼できます。ファイル名、選択した部品、マテリアル、指定位置、視点をチャットへ共有します。

**現在は0.1.8の実験段階です。表示と修正箇所の共有を実装しています。Blenderのライブ編集とTripoでの生成は未接続です。**

![同梱のサンプルモデルで位置を指定した画面](docs/images/surface-point.png)

*画像はプロジェクト同梱のStudio Companionです。単独プレビューのため、チャットへの共有は行っていません。*

## 主な機能

| 機能 | 対応内容 |
|---|---|
| GLB / VRM | 埋め込み画像付きglTF 2.0、VRM 0.x / 1.0を表示 |
| Blend | ローカルBlenderでプレビュー用GLBへ変換。元ファイルを上書きしません |
| マテリアル | PBR、Unlit、MToon拡張。Original / PBR / MToon / Wireを切り替え |
| 場所の指定 | 表面に①の印を置く。回転・ズームをしても同じ場所を指します |
| チャットの文脈 | 部品名、マテリアル、表面の位置、カメラなどをホストへ共有 |
| 表示と操作 | 回転、ズーム、部品・マテリアル選択、グリッド、明暗テーマ、印付き画像の保存 |
| Blender設定 | 画面から実行ファイルを設定・変更。設定は更新後も保持 |

## 動作環境

- **Node.js 22以上**。リリース配布物にはライブラリを同梱しています。
- **ローカルstdio MCPとMCP Appsを利用できるホスト**。チャットへの文脈共有には`ui/update-model-context`への対応が必要です。
- `.blend`の変換には**Blender**。GLB・VRMの表示には不要です。
- **Windowsでの導入を検証済み**。macOS・Linux向けの実行ファイル検出処理はありますが、導入とGUIは未検証です。

WindowsのCodexデスクトップ環境で、MCPの起動・ツール・画面の取得を検証しています。表示と文脈共有は公式AppBridgeを使った検証画面でも確認しています。CLI単体にはこの3D画面を表示する機能がありません。

この版はローカルプロセスを使います。GitHubに公開するだけではChatGPTのブラウザー版や公開プラグインディレクトリーへ接続されません。サイドバー・ファイル入口の表示はホストの対応状況に依存します。[ホストの導入仕様](https://developers.openai.com/plugins/build/plugins)も確認してください。

## Windowsでインストール

1. **[v0.1.8のビルド済みZIP](https://github.com/Maguro-Tsukiji/blend-studio/releases/download/v0.1.8/Blend-Studio-0.1.8.zip)**を取得します。新しい版は[Releases](https://github.com/Maguro-Tsukiji/blend-studio/releases)から確認できます。
2. ZIPを右クリックし、**「すべて展開」**します。
3. `blend-studio`フォルダー内の**`Install-Blend-Studio.cmd`**をダブルクリックします。
4. **「完了：Blend Studio」**が表示されたら、対応するデスクトップアプリを再起動します。
5. Blend Studioを選び、チャットで「Blend Studioを開いて」と依頼します。

インストーラーはNode.jsとCodexを検出し、現在のユーザーの設定領域へ登録します。ソフトの自動ダウンロードは行いません。GitHubの**Code → Download ZIPはソースコード**なので、下記のビルドが必要です。

Blenderは後から**画面上部の「設定」→「参照…」**で指定できます。導入、更新、再設定、トラブル対応は[導入ガイド](docs/INSTALLATION.md)にあります。

## 使い方

1. **「ファイルを開く」**からモデルを選択します。ドラッグ＆ドロップも使えます。
2. 回転・ズームで対象を見つけ、右側の**「場所を指定」**を押します。
3. 修正したい表面をクリックして①の印を付けます。
4. **「チャットへ位置を共有しました」**を確認し、ホストのチャットに修正内容を入力します。

指定できる場所は1か所です。「場所を指定し直す」で置き換え、「位置を解除」で消去できます。別の部品・マテリアルを選ぶと解除されます。ファイルを変更しても古い印は引き継ぎません。

指定モードではEnterで画面中央の表面を指定、Escでキャンセルできます。共有に対応していないホストや単独プレビューでは、印付きの画像を保存してチャットに添付できます。画像は自動送信しません。

## ソースから試す

リポジトリのルートで実行します。

```sh
npm ci
npm run build
npm test
npm run preview
```

`http://127.0.0.1:43123`を開くと、同梱サンプルで表示を試せます。終了はCtrl+Cです。これは単独プレビューなので、ホストのチャットには接続しません。インストール済みのMCP画面を開く際に、localhostを開く必要はありません。

配布フォルダーは`npm run package`、公開用のソース一式は`npm run export:source`で生成できます。[開発ガイド](CONTRIBUTING.md)と[リリース手順](docs/PUBLISHING.md)を参照してください。

## 制約

- `.blend`はBlenderのglTFエクスポーターが表現できる範囲のプレビューです。任意のシェーダーノード、コンポジット、Blender固有の効果は完全には再現しません。
- `.blend`内のMToonノードをMToon拡張へ自動変換しません。MToonを保持する場合は対応GLBまたはVRMを使います。
- ファイル選択から読む`.blend`の外部テクスチャは、事前にBlenderでパックしてください。
- Draco圧縮・KTX2・外部URLや外部ファイルを参照するGLBは未対応です。MeshoptはホストのWebAssembly対応にも依存します。
- リグ・スキンは表示します。アニメーションの再生UIは未実装です。
- 1ファイル256 MiBまで。1セッション最大8モデル・合計512 MiBで、古いモデルは再読み込みが必要になる場合があります。
- 印の位置はプレビュー上の座標・三角形です。Blenderの元データの頂点番号や座標へ直接適用できません。

## データの扱い

モデルの解析・変換・描画はローカルで行います。モデルのバイナリーをこのプラグインから外部サービスへ送信する機能はありません。

チャット連携では、ファイル名・部品名・マテリアル名・指定位置・視点などの**モデル文脈をホストへ共有**します。ホスト側の保存・送信は、そのサービスの設定とポリシーに従います。モデル文脈には機密の名称が含まれる可能性があります。

設定・ログ・一時データの保存場所は[導入ガイド](docs/INSTALLATION.md)、実装上の境界と脆弱性の報告方法は[SECURITY.md](SECURITY.md)を参照してください。

## 今後の方向

- Blenderの作業コピーを編集し、変更前後を比較できる連携
- Tripoの生成・再生成とジョブ管理
- 点に加え、複数箇所や範囲を指定する操作
- VRM・OS・ホストごとの検証拡充

設計案は[ADAPTERS.md](docs/ADAPTERS.md)にあります。実装済みの機能と予定の機能を区別して記載しています。

## 参加とライセンス

不具合報告・改善提案・Pull Requestを歓迎します。[CONTRIBUTING.md](CONTRIBUTING.md)の手順を確認してください。報告に私有モデル、APIキー、個人のパスを含めないようお願いします。

プロジェクトのコードと独自サンプルは[MIT License](LICENSE)です。依存ライブラリは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、同梱スキーマは[schemas/README.md](schemas/README.md)を参照してください。読み込むモデルやテクスチャの権利は、それぞれの権利者に帰属します。

Blend Studioは独立したプロジェクトです。OpenAI、Blender、Tripoの公式製品ではありません。
