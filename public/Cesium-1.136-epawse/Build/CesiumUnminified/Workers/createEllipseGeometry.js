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
  EllipseGeometry_default
} from "./chunk-CJOV55CW.js";
import "./chunk-A53R2F2L.js";
import "./chunk-L4JLDVCM.js";
import "./chunk-DICY26ID.js";
import "./chunk-RXZDTDIY.js";
import "./chunk-OOCGX2OD.js";
import "./chunk-GKWOUMYA.js";
import "./chunk-QUAH3XOT.js";
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
import {
  Ellipsoid_default
} from "./chunk-TDSVSW5A.js";
import {
  Cartesian3_default
} from "./chunk-3YTMGEXW.js";
import "./chunk-IL5F6WEE.js";
import "./chunk-QEANVUGT.js";
import {
  defined_default
} from "./chunk-2RCIRXNI.js";

// packages/engine/Source/Workers/createEllipseGeometry.js
function createEllipseGeometry(ellipseGeometry, offset) {
  if (defined_default(offset)) {
    ellipseGeometry = EllipseGeometry_default.unpack(ellipseGeometry, offset);
  }
  ellipseGeometry._center = Cartesian3_default.clone(ellipseGeometry._center);
  ellipseGeometry._ellipsoid = Ellipsoid_default.clone(ellipseGeometry._ellipsoid);
  return EllipseGeometry_default.createGeometry(ellipseGeometry);
}
var createEllipseGeometry_default = createEllipseGeometry;
export {
  createEllipseGeometry_default as default
};
