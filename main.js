import*as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// 创建场景、相机、渲染器
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 轨道控制器（允许鼠标拖拽视角）
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 创建恒星（太阳）
const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
const sunTexture = new THREE.TextureLoader().load('images/solar.jpg');
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 ,map: sunTexture });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);

//scene.add(sun);

// 轨道半径
const orbits = [
    { radius: 6, tilt: Math.PI * 0 / 8 },
    { radius: 8, tilt: Math.PI * 1 / 8 },
    { radius: 12, tilt: Math.PI * 1.5 / 8 }
];

let yellowPlanets = [];
let blueBalls = [];
let activeOrbitIndex = 2;
let attachedCount = 0;
let isSystemResetting = false;
const delayBeforeAttraction = 3000; // 新的蓝色小球 3s 内不会被吸附

// 创建黄色线框球体
function createYellowPlanet(orbitIndex) {
    const planetGeometry = new THREE.SphereGeometry(0.5, 6, 6);
    const planetWireframe = new THREE.WireframeGeometry(planetGeometry);
    const planetMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa });

    const yellowPlanet = new THREE.LineSegments(planetWireframe, planetMaterial);
    scene.add(yellowPlanet);

    yellowPlanets.push({
        planet: yellowPlanet,
        angle: 0,
        index: orbitIndex,
        orbitRadius: orbits[orbitIndex].radius,
        orbitTilt: orbits[orbitIndex].tilt,
        hasAttached: false
    });

    return yellowPlanet;
}

// 创建蓝色小球（延迟吸附）
function createBlueBall(yellowPlanetIndex) {
    const blueBallGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const blueBallMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff ,map: sunTexture });
    const blueBall = new THREE.Mesh(blueBallGeometry, blueBallMaterial);
    
    // 让蓝色球体远离黄色球体生成
    const distanceFactor = 6; // 让蓝色球体生成在轨道之外
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnRadius = orbits[yellowPlanetIndex].radius + distanceFactor;
    
    blueBall.position.set(
        Math.cos(spawnAngle) * spawnRadius,
        Math.sin(spawnAngle) * spawnRadius * Math.tan(orbits[yellowPlanetIndex].tilt),
        Math.sin(spawnAngle) * spawnRadius
    );

    scene.add(blueBall);

    blueBalls.push({
        ball: blueBall,
        isAttached: false,
        targetPlanetIndex: yellowPlanetIndex,
        attractionEnabled: false
    });

    // 3 秒后才允许该蓝色小球被吸附
    setTimeout(() => {
        blueBalls.forEach(obj => {
            if (obj.ball === blueBall) {
                obj.attractionEnabled = true;
            }
        });
    }, delayBeforeAttraction);
}
// 移除黄球和相关蓝球
function removeYellowPlanet(planetObj) {
    scene.remove(planetObj.planet);
    yellowPlanets = yellowPlanets.filter(p => p !== planetObj);

    blueBalls = blueBalls.filter((b,index)=> {
        if (b.targetPlanetIndex === planetObj.index) {
            scene.remove(b.ball);
            // blueBalls.splice(index,1);
            return false;
        }
        return true;
    });
}


// 吸附逻辑
function checkAttraction() {
    if (isSystemResetting) return;

    yellowPlanets.forEach((obj) => {
        let index=obj.index;
        if (!obj.hasAttached) {
            const planetScreenPos = getScreenPosition(obj.planet);
            blueBalls.forEach((blueObj) => {
                if (blueObj.isAttached || blueObj.targetPlanetIndex !== index || !blueObj.attractionEnabled) return;

                const blueBallScreenPos = getScreenPosition(blueObj.ball);
                const dx = blueBallScreenPos.x - planetScreenPos.x;
                const dy = blueBallScreenPos.y - planetScreenPos.y;
                const screenDistance = Math.sqrt(dx * dx + dy * dy);

                if (screenDistance < 50) {
                    // 吸附
                    obj.hasAttached = true;
                    blueObj.isAttached = true;
                    blueObj.ball.position.copy(obj.planet.position);
                    
                    setTimeout(() => {
                        if (attachedCount < 2) {
                            attachedCount++;
                            createYellowPlanet(activeOrbitIndex - 1);
                            createBlueBall(activeOrbitIndex - 1);
                            activeOrbitIndex--;
                        } else {
                            // resetSystem();
                            delta=delta+0.1;
                            attachedCount = 0;
                            activeOrbitIndex = 2;
                            isSystemResetting = false;
                    
                            createYellowPlanet(activeOrbitIndex);
                            createBlueBall(activeOrbitIndex);
                        }
                        if (yellowPlanets.length > 2) {
                            const old = yellowPlanets.shift();
                            removeYellowPlanet(old);
                            // yellowPlanets.splice(0,1);
                        }
                    }, 1000);
                }
            });
        }
    });
}

// 复位系统
function resetSystem() {
    isSystemResetting = true;
    setTimeout(() => {
        yellowPlanets.forEach(obj => scene.remove(obj.planet));
        blueBalls.forEach(obj => scene.remove(obj.ball));
        yellowPlanets = [];
        blueBalls = [];
        attachedCount = 0;
        activeOrbitIndex = 2;
        isSystemResetting = false;

        createYellowPlanet(activeOrbitIndex);
        createBlueBall(activeOrbitIndex);
    }, 500);
}

// 让蓝色小球跟随鼠标
window.addEventListener('mousemove', (event) => {
    blueBalls.forEach(obj => {
        if (obj.isAttached) return;

        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = -(event.clientY / window.innerHeight) * 2 + 1;

        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z * 0.5;

        obj.ball.position.copy(camera.position.clone().add(dir.multiplyScalar(distance)));
    });
    
    // for (let i = 0; i < starCount; i++) {
    //     const dx = starPositions[i * 3] - mouse.x;
    //     const dy = starPositions[i * 3 + 1] - mouse.y;
    //     const dz = starPositions[i * 3 + 2] - mouse.z;
    //     const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;

    //     // 计算爆炸方向
    //     starVelocities[i * 3] += (dx / distance) * explodeForce * (Math.random() + 0.5);
    //     starVelocities[i * 3 + 1] += (dy / distance) * explodeForce * (Math.random() + 0.5);
    //     starVelocities[i * 3 + 2] += (dz / distance) * explodeForce * (Math.random() + 0.5);
    // }
});
let pressed=false;
window.addEventListener('mousedown', (event) => {
    pressed=true;
});
window.addEventListener('mouseup', (event) => {
    pressed=false;
});
// 初始化
createYellowPlanet(activeOrbitIndex);
createBlueBall(activeOrbitIndex);
// **创建一个聚光灯，模拟反光**
const spotLight = new THREE.SpotLight(0xffffff, 2);
spotLight.position.set(5, 10, 5);
spotLight.castShadow = true;
scene.add(spotLight);

// 吸附半径
const attractDistance = 2; // 适当加大
const screenAttractDistance = 50; // 屏幕距离小于 50 像素时吸附
let isAttached = false;



// 轨道半径和角度（初始值）
const radius1=6;
const radius2=8;
const radius3=12;
const radius4=14;
const radius5=16;
const radius6=18;
const angle1=Math.PI*0 / 8;
const angle2=Math.PI*1 / 8;
const angle3=Math.PI*1.5 / 8;
const angle4=Math.PI*2 / 8;
const angle5=Math.PI*2.5 / 8;
const angle6=Math.PI*3 / 8;
let orbitRadius = radius3;
let angle = 0;
let orbitTilt = angle3; // 轨道倾角
// 添加点光源（太阳的光）
const light1 = new THREE.PointLight(0xffffff, 2, 100);
light1.position.set(25, 25, 25); // 让光源偏移一些，以更好地照亮行星
scene.add(light1);
const light2 = new THREE.PointLight(0xffffff, 2, 100);
light2.position.set(-25, -25, -25); // 让光源偏移一些，以更好地照亮行星
scene.add(light2);
const ambientLight = new THREE.AmbientLight(0xaaaaaa, 2); // 软光照增强
scene.add(ambientLight);
// **增强全局环境光**
const ambientLight1 = new THREE.AmbientLight(0x666666, 1.5); 
scene.add(ambientLight1);


// 添加光源
const light = new THREE.PointLight(0xffffff, 1.5, 50);
light.position.set(0, 0, 0);
scene.add(light);

// 设置相机位置
camera.position.set(0, 10, 20);

// 繁星粒子系统（带物理特性）
const starGeometry = new THREE.BufferGeometry();
const starCount = 1500;
const starPositions = new Float32Array(starCount * 3);
const starVelocities = new Float32Array(starCount * 3); // 速度数组
const starBrightness = new Float32Array(starCount);
const starTexture = new THREE.TextureLoader().load('images/star.png'); // 贴图
for (let i = 0; i < starCount; i++) {
    const r = Math.random() * 40 + 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    
    starPositions[i * 3] = x;
    starPositions[i * 3 + 1] = y;
    starPositions[i * 3 + 2] = z;

    // 速度初始为 0
    starVelocities[i * 3] = 0;
    starVelocities[i * 3 + 1] = 0;
    starVelocities[i * 3 + 2] = 0;

    starBrightness[i] = Math.random(); // 亮度
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('velocity', new THREE.BufferAttribute(starVelocities, 3));
starGeometry.setAttribute('brightness', new THREE.BufferAttribute(starBrightness, 1));

// 鼠标排斥力
let mouse = new THREE.Vector3(0, 0, 0);
let repelForce = 1; // 鼠标排斥力度
let explodeForce = 5; // 爆炸力


// 获取 3D 坐标对应的屏幕坐标
function getScreenPosition(object) {
    const vector = new THREE.Vector3();
    vector.setFromMatrixPosition(object.matrixWorld);
    vector.project(camera);
    
    return {
        x: (vector.x * 0.5 + 0.5) * window.innerWidth,
        y: (1 - (vector.y * 0.5 + 0.5)) * window.innerHeight
    };
}

// // 监听鼠标点击触发爆炸
window.addEventListener('click', () => {
    for (let i = 0; i < starCount; i++) {
        const dx = starPositions[i * 3] - mouse.x;
        const dy = starPositions[i * 3 + 1] - mouse.y;
        const dz = starPositions[i * 3 + 2] - mouse.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;

        // 计算爆炸方向
        starVelocities[i * 3] += (dx / distance) * explodeForce * (Math.random() + 0.5);
        starVelocities[i * 3 + 1] += (dy / distance) * explodeForce * (Math.random() + 0.5);
        starVelocities[i * 3 + 2] += (dz / distance) * explodeForce * (Math.random() + 0.5);
    }
});

// 创建星星 Shader 材质
const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0.0 },
        starTexture: { value: starTexture },
        color:  { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
        attribute float brightness;
        varying float vBrightness;
        void main() {
            vBrightness = brightness;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 3.0 * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform sampler2D starTexture;
        varying float vBrightness;

        void main() {
            vec2 uv = gl_PointCoord;
            vec4 texColor = texture2D(starTexture, uv);

            float flicker = abs(sin(time * (0.5 + vBrightness * 0.5))) * 0.6 + 0.4; 
            gl_FragColor = texColor * flicker;
        }
    `,
    transparent: true
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);



// 创建轨道
function createOrbit(radius, tilt, color1 = 0x00ffff, color2 = 0xff00ff) {
    const curve = new THREE.EllipseCurve(
        0, 0,
        radius, radius,
        0, 2 * Math.PI, 
        true,
        120
    );

    const points = curve.getPoints(1000).map(p => new THREE.Vector3(p.x, Math.tan(tilt) * p.y, p.y));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // 使用 ShaderMaterial 实现科幻轨道
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color(color1) }, // 外层霓虹蓝
            color2: { value: new THREE.Color(color2) }, // 内层深蓝
            time: { value: 0.0 }  // 动态时间控制
        },
        vertexShader: `
            varying float vUv;
            void main() {
                vUv = position.y * 0.1 + 0.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float time;
            varying float vUv;
            
            void main() {
                float glow = abs(sin(time + vUv * 6.28)) * 0.5 + 0.5;
                vec3 color = mix(color2, color1, glow);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        transparent: false
    });

    const orbit = new THREE.Line(geometry, material);
    scene.add(orbit);
    return orbit;
}
// 监听键盘事件以改变轨道
window.addEventListener('keydown', (event) => {
    if (event.key === '1') {
        orbitRadius = radius1;
        orbitTilt = angle1;
    } else if (event.key === '2') {
        orbitRadius = radius2;
        orbitTilt = angle2;
    } else if (event.key === '3') {
        orbitRadius = radius3;
        orbitTilt = angle3;
    }else if (event.key === '4') {
        orbitRadius = radius4;
        orbitTilt = angle4;
    } else if (event.key === '5') {
        orbitRadius = radius5;
        orbitTilt = angle5;
    } else if (event.key === '6') {
        orbitRadius = radius6;
        orbitTilt = angle6;
    }
});

// 替换轨道
const orbit1 = createOrbit(radius1, angle1);
const orbit2 = createOrbit(radius2, angle2);
const orbit3 = createOrbit(radius3, angle3);
const orbit4 = createOrbit(radius3, -angle3, 0xffc0cb, 0xaa6066);
let camAngle = 0;
let delta=0.0;
const loader = new THREE.TextureLoader();
loader.load('images/star1.png',
    function (texture) {
        console.log('✅ 背景加载成功');
        scene.background = texture;
    },
    undefined,
    function (err) {
        console.error('❌ 背景加载失败:', err);
    }
);

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    if(!pressed){
        camAngle += 0.002; // 控制旋转速度
        const camRadius = 20; // 摄像机绕的半径
        
        camera.position.x = Math.cos(camAngle) * camRadius;
        camera.position.z = Math.sin(camAngle) * camRadius;
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
    


    // 更新星星闪烁时间
    starMaterial.uniforms.time.value += 0.02;

    // 更新星星粒子运动
    const positions = starGeometry.attributes.position.array;
    const velocities = starGeometry.attributes.velocity.array;

    for (let i = 0; i < starCount; i++) {
        // 计算星星到鼠标的距离
        const dx = positions[i * 3] - mouse.x;
        const dy = positions[i * 3 + 1] - mouse.y;
        const dz = positions[i * 3 + 2] - mouse.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;

        // 鼠标排斥力
        // const force = repelForce/100.0;
        // velocities[i * 3] += (dx / distance) * force;
        // velocities[i * 3 + 1] += (dy / distance) * force;
        // velocities[i * 3 + 2] += (dz / distance) * force;
        

        // 位置更新
        positions[i * 3] += velocities[i * 3] * 0.1;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.1;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.1;

        // 逐渐让速度衰减（模拟阻力）
        velocities[i * 3] *= 0.99;
        velocities[i * 3 + 1] *= 0.99;
        velocities[i * 3 + 2] *= 0.99;

        // 远离中心太远的星星逐渐吸引回原位
        const initialDistance = 100;
        if (Math.sqrt(positions[i * 3] ** 2 + positions[i * 3 + 1] ** 2 + positions[i * 3 + 2] ** 2) > initialDistance) {
            velocities[i * 3] -= positions[i * 3] * 0.005;
            velocities[i * 3 + 1] -= positions[i * 3 + 1] * 0.005;
            velocities[i * 3 + 2] -= positions[i * 3 + 2] * 0.005;
        }
    }

    starGeometry.attributes.position.needsUpdate = true;
    starGeometry.attributes.velocity.needsUpdate = true;

    // 让轨道发光动起来
    orbit1.material.uniforms.time.value += 0.03;
    orbit2.material.uniforms.time.value += 0.03;
    orbit3.material.uniforms.time.value += 0.03;
    orbit4.material.uniforms.time.value += 0.03;

    // 更新行星轨道位置
    
    yellowPlanets.forEach((obj) => {
        let index=obj.index;
        obj.angle += 0.02*(1+index+delta);
        obj.planet.position.set(
            Math.cos(obj.angle) * obj.orbitRadius,
            Math.sin(obj.angle) * obj.orbitRadius * Math.tan(obj.orbitTilt),
            Math.sin(obj.angle) * obj.orbitRadius
        );

        blueBalls.forEach(blueObj => {
            if (blueObj.isAttached && blueObj.targetPlanetIndex === index) {
                blueObj.ball.position.copy(obj.planet.position);
            }
        });
    });

    checkAttraction();
    
    controls.update();
    renderer.render(scene, camera);
}
animate();
