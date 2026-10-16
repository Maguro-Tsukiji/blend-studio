# インストール・設定・トラブル対応

[READMEへ戻る](../README.md)

このガイドはWindows向けです。ローカルstdio MCPとMCP Appsに対応したデスクトップホスト、Node.js 22以上を用意してください。インストーラーはCodexのプラグイン登録コマンドを利用します。ChatGPTのブラウザー版への登録や公開ディレクトリーへの掲載は行いません。

## ビルド済みZIPを使う

1. [Releases](https://github.com/Maguro-Tsukiji/blend-studio/releases)からビルド済み配布ZIPを取得します。現在の版は[Blend-Studio-0.1.13.zip](https://github.com/Maguro-Tsukiji/blend-studio/releases/download/v0.1.13/Blend-Studio-0.1.13.zip)です。GitHubが自動生成する「Source code」ZIPとは別です。
2. ZIP全体を「すべて展開」し、`blend-studio`フォルダーを開きます。
3. `Install-Blend-Studio.cmd`をダブルクリックします。黒い画面に進捗・結果が表示されます。
4. 「完了：Blend Studio」が表示されたら、デスクトップアプリを再起動します。
5. ホストでBlend Studioを選び、「Blend Studioを開いて」と依頼します。

管理者として実行する必要はありません。現在のユーザーの設定領域を使います。Node.js、Codex、Blenderを自動ダウンロードする機能はありません。インストーラーが必要なソフトの不足を表示した場合は、先にそのソフトを導入してください。

インストーラーはデスクトップ同梱のCodexを優先して探し、プラグイン登録コマンドを使えるか確認します。端末の`codex`がnpm版を指していても、同梱版を検出できれば登録に使います。npm版しか見つからない場合、CLIでの登録成功だけではデスクトップの画面対応を保証できません。

## ソースからビルドする

リポジトリのルートで実行します。

```sh
npm ci
npm run build
npm test
npm run package
```

配布物は`release/blend-studio/`に生成されます。このフォルダーの`Install-Blend-Studio.cmd`を実行します。`node_modules`をコピーする必要はありません。

インストーラーのGUIを使う場合は、PowerShellで次を実行できます。

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\release\blend-studio\Install-Blend-Studio.ps1
```

`ExecutionPolicy Bypass`はこの起動だけに適用されます。組織の実行制限がある環境では管理者の方針に従ってください。

## Blenderを後から設定する

GLB・VRMはBlenderなしで利用できます。`.blend`を読み込む場合は、画面上部の**「設定」**、または右側のBlender設定ボタンを開きます。

1. **「参照…」**で`blender.exe`を選びます。フォルダーやショートカットではなく実行ファイルを指定します。
2. 保存するとBlenderのバージョンを確認し、設定を保持します。
3. 失敗した`.blend`を再度開きます。

移動・再インストールしたBlenderのパスも同じ画面で変更できます。以前指定したパスが無効になった場合は、再指定するか設定を解除してください。保存済みのパスを優先するため、無効な設定が残るとPATHの自動検出に切り替わりません。

## 更新

新しい配布ZIPを展開し、同じインストーラーを実行します。Blender設定はプラグイン本体とは別に保存されます。同じ内容の配布物を再実行した場合は、既存の登録を再利用します。

内容が変わった配布物への更新でアクセス拒否が発生した場合は、作業を保存してデスクトップホストを完全に終了し、再実行してください。インストーラーは他の実行中プロセスを強制終了しません。

## 保存場所

Windowsの標準設定です。

| 場所 | 内容 |
|---|---|
| `%LOCALAPPDATA%\BlendStudio\plugin` | 安定したインストール元 |
| `%LOCALAPPDATA%\BlendStudio\settings.json` | Blenderのパスなど |
| `%LOCALAPPDATA%\BlendStudio\installation.json` | 登録・検証結果 |
| `%LOCALAPPDATA%\BlendStudio\installer.log` | CMD版の導入ログ |
| Codexのプラグインキャッシュ | ホストが管理する実行用コピー |
| OSの一時フォルダー内の`blend-studio-*` | アップロードしたBlend、変換用ファイル |

通常終了時にセッション用の一時フォルダーを削除します。強制終了時には残ることがあります。ログや設定にはユーザーのパスが含まれるため、公開する前に伏せてください。

`BLEND_STUDIO_CONFIG_DIR`で設定の保存先を変更できます。macOS・Linuxの既定値は`$XDG_CONFIG_HOME/blend-studio`、未設定なら`~/.config/blend-studio`です。これらのOSでのインストールとGUIは未検証です。

## 単独プレビュー

```sh
npm run preview
```

`http://127.0.0.1:43123`をブラウザーで開きます。終了はCtrl+Cです。配布物では`Start-Preview.ps1`も利用できます。

これは開発・表示確認用です。ホストのチャットへ位置を共有する機能はありません。必要なら印付き画像を保存してチャットへ添付します。通常のMCP Apps画面はホストがHTMLを取得するため、localhostを開く必要はありません。

## よくある問題

### CMDを押しても進まない

ZIP内から直接実行せず、全体を展開してください。CMDとPS1、`server`、`dist`などが同じ配布フォルダーに必要です。端末からCMDを実行すると結果を読みやすくなります。

```powershell
.\Install-Blend-Studio.cmd
```

画面の結果と`installer.log`を確認します。コードや実行制限を確認するため、常に管理者権限で実行する方法は推奨しません。

### `failed to back up plugin cache entry` / アクセスが拒否される

実行中のMCPがキャッシュを使用している場合があります。同じ配布物の再実行なら、現在のインストーラーは内容を比較して登録を再利用します。変更のある更新なら、ホストを完全に終了して再実行します。ホスト管理のキャッシュを手動で上書きしないでください。

### サイドバーに入口がない・localhostを開こうとする

ホストを更新・再起動し、プラグインの接続・有効化を確認してください。インストーラーはMCPツール、グローバル入口のメタデータ、UIリソースを確認しますが、ホストの実際のサイドバー表示までは保証しません。CLI単体は3D画面を表示しません。

### Blendのテクスチャがない

Blenderで外部画像をパックして保存し直してください。画面のファイル選択では元ファイルの隣にある画像を自動では読みません。ローカルパスを指定して開く場合は、Blenderが元の参照画像へアクセスできるか確認します。任意のシェーダーノードやMToonの自動変換は未対応です。

### ①がチャットへ共有されない

ホストが`ui/update-model-context`に対応している必要があります。画面の共有結果を確認してください。単独プレビューや未対応ホストでは、印付き画像を保存して添付します。

再現する場合は[不具合報告の手順](../CONTRIBUTING.md)に従い、個人情報を除いた環境・手順・エラーを添えてください。
