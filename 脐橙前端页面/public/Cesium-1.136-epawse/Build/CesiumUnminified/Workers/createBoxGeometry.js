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
  BoxGeometry_default
} from "./chunk-B7JRBTT6.js";
import "./chunk-GKWOUMYA.js";
import "./chunk-QUAH3XOT.js";
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
import {
  defined_default
} from "./chunk-2RCIRXNI.js";

// packages/engine/Source/Workers/createBoxGeometry.js
function createBoxGeometry(boxGeometry, offset) {
  if (defined_default(offset)) {
    boxGeometry = BoxGeometry_default.unpack(boxGeometry, offset);
  }
  return BoxGeometry_default.createGeometry(boxGeometry);
}
var createBoxGeometry_default = createBoxGeometry;
export {
  createBoxGeometry_default as default
};
