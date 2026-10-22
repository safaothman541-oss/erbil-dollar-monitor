#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Vertex OS: SafaDroid Local AI Setup (Llama-3.2 1B on Android)
# ==============================================================================

set -e

echo "👑 دەستپێکردنی دامەزراندنی مۆدێلی ناوخۆیی (Llama-3.2 1B) لەسەر مۆبایلی کاکە سەفا..."

# 1. Update packages
pkg update -y && pkg install -y curl wget git clang cmake

# 2. Directory setup
mkdir -p ~/safa-local-ai
cd ~/safa-local-ai

# 3. Download Llama-3.2-1B-Instruct GGUF (Optimized 4-bit, ~770MB)
MODEL_NAME="Llama-3.2-1B-Instruct-Q4_K_M.gguf"
MODEL_URL="https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"

if [ ! -f "$MODEL_NAME" ]; then
    echo "📥 خەریکی داونلۆدکردنی مۆدێلی Llama-3.2 1B بۆ ناو مۆبایلەکەتە (770MB)..."
    wget -c "$MODEL_URL" -O "$MODEL_NAME"
else
    echo "✅ مۆدێلی $MODEL_NAME پێشتر داگیراوە."
fi

# 4. Clone and compile llama.cpp natively on device
if [ ! -d "llama.cpp" ]; then
    echo "⚙️ دروستکردنی ماتۆڕی کارپێکردن بە پرۆسێسەری مۆبایل (Llama.cpp)..."
    git clone --depth 1 https://github.com/ggerganov/llama.cpp
    cd llama.cpp
    cmake -B build
    cmake --build build --config Release -j 4 --target llama-server
    cd ..
fi

echo "============================================================"
echo "🎉 پیرۆزە! مۆدێلی Llama-3.2 بە سەرکەوتوویی لەناو مۆبایلت ئامادە کرا."
echo "بۆ دەستپێکردن تەنها ئەمە لێبدە:"
echo "cd ~/safa-local-ai && ./llama.cpp/build/bin/llama-server -m Llama-3.2-1B-Instruct-Q4_K_M.gguf --port 8080 -c 2048"
echo "============================================================"
