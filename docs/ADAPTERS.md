# 今後のBlender・Tripo連携

初期版は表示、Blenderからのプレビュー変換、ChatGPTへの相談まで実装しています。ライブ編集、生成、課金を伴う操作を行うアダプターは未接続です。

## 画面 → ChatGPT

`ui/update-model-context`でファイル名・assetId・選択部位・glTFインデックス・マテリアル名・表面の指定位置・カメラ・表示モードを渡します。修正指示はホストのMCP Extensionsチャットへ入力します。ビューアー内の入力欄と送信ボタンはありません。単独プレビューにはチャット連携がありません。

「場所を追加」→表面をクリックするたびに、`targets`配列へ`kind: surface-point`、安定した`id`、`label: ①`などの番号、対象オブジェクト／マテリアル、`localPosition`、`triangleIndex`、`vertexIndices`、`barycentric`、`uv`（存在する場合）を渡します。互換用の`target`には残っている最後の点を含めます。番号と配列順序は同一とは限りません。glTFのノード・メッシュ・プリミティブのインデックスも存在する場合に含めます。位置は`preview-mesh-local-posed`座標系で、表示中のスキン／モーフを含むメッシュのローカル座標です。カメラと表示用の中心合わせには依存しません。三角形と重みから表面の位置を再構成します。Blender元データの座標・頂点番号には直接適用できません。

指定は各タブ最大8か所です。個別削除と全解除に対応し、残りの番号は変えず、削除済み番号も再利用しません。別の部品／マテリアル選択、回転・ズーム・描画モード変更では保持します。同じタブのモデル更新では全消去し、`targets: []`、`target: null`を共有します。タブ切り替えではそのタブの指定と視点を復元します。指定モードではEnterで画面中央の表面を追加し、Escで終了できます。スクリーンショットには印を含めます。画像の自動送信はしません。

`camera.view`は`front | left | right | back | free`、`camera.projection`は`orthographic | perspective`です。`frontYaw`はカスタム正面の水平角です。VRMAを読み込むと`animation: { name, duration, time, playing, rate, loop }`を含め、未読込時はnullです。再生中は約1秒ごとに現在のポーズの位置情報を共有します。正確な指示には該当ポーズで一時停止してください。VRMAは表示用モデルにのみ適用し、Blenderへ書き戻しません。

ライティング調整時には`lighting: { preset, exposure, environment, ambient, ambientColor, key: { intensity, color, azimuth, elevation }, fill: { intensity, color, azimuth, elevation } }`を共有します。角度は度数で、水平0°は設定した正面、90°は左側面、高さ0°は水平、90°は真上です。カメラとは独立しています。設定はタブごとに保持し、同じ編集セッションの保存・修正結果読み込みでは引き継ぎます。元ファイルのライトやマテリアルは変更しません。見た目の色を判断するときは、マテリアルと表示用ライティングを区別してください。

## 修正ファイル → 依頼元の画面（実装済み）

モデル文脈には `viewer: { id, tabId, sessionId, revision, tabs: [{ id, sessionId, revision, name, assetId }] }` と、接続中の`workingFile`を含めます。`sessionId`は同じ作業ファイルの保存・再読み込みを繰り返しても保持します。通常のファイル置き換えでは新しいセッションを作り、古い編集結果と区別します。別の編集ツールで作業コピーを更新した後、次のツールを呼びます。

```js
studio.open_revision({
  path: revisedLocalFilePath,
  sessionId: originatingContext.viewer.sessionId,
  expectedRevision: originatingContext.viewer.revision,
  openMode: "replace"
})
```

このツールはUIリソースを返さず、依頼元の画面に読み込み要求をキュー登録します。`status: queued`は登録済みを意味し、表示完了を意味しません。`openMode: replace`は元タブを直接更新し、`ask`では更新先を選ぶダイアログを表示します。新しい内部タブを明示する場合は`new-tab`を使います。受信した画面のMCP接続で`studio.load_revision`を呼んで変換するため、別プロセス側のバイナリーIDに依存しません。

画面はapp-onlyの `studio.view_updates` で2秒ごとに要求と作業ファイルの更新を確認し、処理後に受領を返します。背景でのタイマー制限や変換時間により遅れることがあります。ルーティング情報は設定領域の`viewer-sessions-v1/`に個別のJSONとして原子的に保存します。異なるローカルMCPプロセスや再接続から参照でき、24時間使われなかった情報を次回利用時に整理します。モデルのバイナリーはこの領域に保存しません。IDは配送識別子であり、認証には使いません。

文脈にIDがない場合は`studio.sessions({})`で現在のセッション・ファイル名・作業パス・最終確認・版を取得して照合します。直近で表示したタブを推測したり、新しい画面へ迂回したりしません。複数候補はユーザーに確認します。セッションはバックグラウンドで一時的にオフライン表示となる場合があります。同じセッション内で更新が進んだ場合、`expectedRevision`の不一致で古い結果を拒否します。元タブを別モデルに置き換えた場合はセッション自体が変わるため、以前の結果で上書きしません。

`studio.open` は通常の入口として残し、`openMode: ask | replace | new-tab` を受け付けます。修正依頼元の文脈があるときは `studio.open_revision` を使い、ホスト側に別の画面を開かせないようにします。タブ状態はメモリー内のみで保存されません。この配送機能は編集操作そのものを実装しません。

## 保存済み作業ファイルの再読み込み（実装済み）

`studio.follow_working_file({ sessionId, path, autoRefresh: true })`で明示された作業ファイルを紐付けます。UIではapp-onlyの`studio.work_file_configure`を使います。Windowsの参照ダイアログは`studio.pick_work_file`でローカル実行します。ブラウザーアップロード名から元の絶対パスを推測しません。

画面が保存後の変更を検知すると`studio.work_file_load({ sessionId, stamp })`で再変換し、同じタブへ反映します。ファイルが保存途中の場合は約0.9秒の落ち着きを待ち、読み込み前後のメタデータと接続設定を再照合します。更新中に変わったファイルや変換失敗では前の表示を保ちます。`autoRefresh: false`なら手動更新、`disconnect: true`なら接続解除です。

更新時はカメラ・描画モード・表示位置を保持し、VRMA・ボーン対応・再生状態を再適用します。リグ構造が変わると手動対応が必要になる場合があります。元タブが非選択なら表示中の別タブは切り替えません。形状の異なるモデルに古い表面指定を適用しないため、選択とすべての印は解除します。最後にディスクへ保存した内容だけを読み、Blenderの未保存メモリーやライブ操作には接続しません。変換した一時GLBとレポートは読み込み後に削除します。ビューを閉じると監視とタブ状態は失われます。

将来の編集アダプターでは、ホストのチャット指示とモデル文脈を次のJSON形式にまとめる設計です。現行ビューアーはこの依頼データを保存・送信しません。

```json
{
  "schemaVersion": 1,
  "asset": { "id": "session-asset-id", "name": "avatar.blend", "format": "glTF 2.0", "demo": false },
  "selection": {
    "kind": "object", "index": 0, "gltfIndex": 3, "name": "Hair",
    "materials": [{ "name": "Hair MToon", "gltfIndex": 1 }]
  },
  "renderMode": "auto",
  "camera": { "position": [1, 2, 3], "target": [0, 1, 0] },
  "instruction": "毛先を少し短くしてください",
  "screenshot": { "mimeType": "image/png", "data": "base64" },
  "integrations": {
    "blender": { "status": "planned", "operation": "edit-copy" },
    "tripo": { "status": "planned", "operation": "regenerate" }
  }
}
```

assetIdはサーバー起動中だけ有効です。glTFIndexはロードしたglTF JSONのインデックスです。画面上のindexはそのビューの選択インデックスです。Blender変換では元オブジェクト名とマテリアル名も保持しますが、生成されたglTFノードとBlenderオブジェクトの対応は変換により複数対一になる場合があります。確定的な編集の前に元ファイル上の対象を再照合してください。

## Blenderアダプター

追加するMCPツールの候補は `blender.plan_edit`、`blender.apply_edit`、`blender.refresh_preview`。ユーザーが指定した元ファイルへの参照と更新番号を保持する層を追加し、選択したオブジェクト名を照合します。変更はコピーに適用してからGLBを再生成し、変更前後のモデルとスクリーンショットを比較できるようにします。現行のコンバーターはプレビュー専用で、ライブBlenderへ接続しません。

## Tripoアダプター

`tripo.plan_generation`、`tripo.start_generation`、`tripo.get_job`、`tripo.import_result`を追加する構成です。APIキーはサーバー側の環境変数または資格情報ストアで管理し、画面へ返しません。生成依頼は選択部位・スクリーンショット・プロンプトから作り、ジョブIDを保持して重複発注を防ぎます。結果のGLBは現在の読込処理へ渡せます。

## 現行構成

- `server/core.mjs`: Blenderプロセス、アップロード、GLB検証、セッション内アセット
- `server/index.mjs`: MCPツール、ファイル／グローバル／チャット入口、UIリソース
- `src/viewer.mjs`: Three.js／three-vrm描画、選択、モデル文脈、画像保存
- `server/preview.mjs`: 127.0.0.1限定の単独プレビュー
- `scripts/convert_blend.py`: 自動Python実行を無効にした別プロセスでのGLB変換

実行用は `.bundle.mjs` と `dist/viewer.html` に依存ライブラリを同梱しています。

仕様参照: [OpenAI MCP Extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md)、[three-vrm](https://github.com/pixiv/three-vrm)。
