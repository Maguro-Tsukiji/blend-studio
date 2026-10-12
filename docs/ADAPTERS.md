# 今後のBlender・Tripo連携

初期版は表示、Blenderからのプレビュー変換、ChatGPTへの相談まで実装しています。ライブ編集、生成、課金を伴う操作を行うアダプターは未接続です。

## 画面 → ChatGPT

`ui/update-model-context`でファイル名・assetId・選択部位・glTFインデックス・マテリアル名・表面の指定位置・カメラ・表示モードを渡します。修正指示はホストのMCP Extensionsチャットへ入力します。ビューアー内の入力欄と送信ボタンはありません。単独プレビューにはチャット連携がありません。

「場所を指定」→モデル表面をクリックすると、`target`に`kind: surface-point`、`label: ①`、対象オブジェクト／マテリアル、`localPosition`、`triangleIndex`、`vertexIndices`、`barycentric`、`uv`（存在する場合）を渡します。glTFのノード・メッシュ・プリミティブを識別するインデックスも存在する場合に含めます。位置は`preview-mesh-local-posed`座標系で、表示中のスキン／モーフを含むメッシュのローカル座標です。カメラと表示用の中心合わせには依存しません。三角形と重みから表面の位置を再構成します。Blender元データの座標・頂点番号には直接適用できません。

指定は1か所です。再指定で置き換え、「位置を解除」、別のオブジェクト／マテリアル選択、ファイル変更で消去し、`target: null`を共有します。回転・ズーム・描画モード変更では保持します。指定モードではEnterで画面中央の表面を指定し、Escでキャンセルできます。スクリーンショットには印を含めます。画像の自動送信はしません。

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
