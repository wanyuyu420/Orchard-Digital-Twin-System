/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.136.0
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  PrimitivePipeline_default
} from "./chunk-O6RZEKHZ.js";
import {
  createTaskProcessorWorker_default
} from "./chunk-2AM4E2WD.js";
import "./chunk-H6Q7E4BQ.js";
import "./chunk-DICY26ID.js";
import "./chunk-RXZDTDIY.js";
import "./chunk-OOCGX2OD.js";
import "./chunk-DMEFNTUV.js";
import "./chunk-4BHWJWS3.js";
import "./chunk-A6YFUGJO.js";
import "./chunk-KROSQJUA.js";
import "./chunk-CW7W27IZ.js";
import "./chunk-GDU4RZSZ.js";
import "./chunk-23T2IPHV.js";
import "./chunk-AOIO5VUS.js";
import "./chunk-W4XUEDU5.js";
import "./chunk-I4REFVXB.js";
import "./chunk-YSYSXSHF.js";
import "./chunk-5JKH4AMT.js";
import "./chunk-TDSVSW5A.js";
import "./chunk-3YTMGEXW.js";
import "./chunk-IL5F6WEE.js";
import "./chunk-QEANVUGT.js";
import "./chunk-2RCIRXNI.js";

// packages/engine/Source/Workers/combineGeometry.js
function combineGeometry(packedParameters, transferableObjects) {
  const parameters = PrimitivePipeline_default.unpackCombineGeometryParameters(packedParameters);
  const results = PrimitivePipeline_default.combineGeometry(parameters);
  return PrimitivePipeline_default.packCombineGeometryResults(
    results,
    transferableObjects
  );
}
var combineGeometry_default = createTaskProcessorWorker_default(combineGeometry);
export {
  combineGeometry_default as default
};
