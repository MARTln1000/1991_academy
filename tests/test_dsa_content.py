"""Execute lesson implementations against independent small-input oracles."""
import bisect
import contextlib
import io
import json
from pathlib import Path
import random
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[1] / 'content' / 'dsa'


def lesson(name):
    return json.loads((ROOT / 'lessons' / f'{name}.json').read_text())


def implementation(name):
    namespace = {}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(lesson(name)['implementations']['python'], name, 'exec'), namespace)
    return namespace


def test_binary_search_matches_bisect_with_duplicates_and_empty_inputs():
    ns = implementation('binary-search')
    rng = random.Random(13)
    for n in range(50):
        a = sorted(rng.randrange(-10, 11) for _ in range(n))
        for target in range(-12, 13):
            assert ns['lower_bound'](a, target) == bisect.bisect_left(a, target)
            assert ns['upper_bound'](a, target) == bisect.bisect_right(a, target)


def test_avl_preserves_order_height_and_balance_after_every_update():
    ns = implementation('avl-tree')
    rng = random.Random(42)
    root, expected = None, set()

    def check(node, lo=float('-inf'), hi=float('inf')):
        if node is None:
            return 0, []
        assert lo < node.key < hi
        lh, left = check(node.left, lo, node.key)
        rh, right = check(node.right, node.key, hi)
        assert abs(lh-rh) <= 1
        assert node.height == 1 + max(lh, rh)
        return node.height, left + [node.key] + right

    for _ in range(1000):
        key = rng.randrange(100)
        if rng.random() < .55:
            root = ns['insert'](root, key)
            expected.add(key)
        else:
            root = ns['erase'](root, key)
            expected.discard(key)
        assert check(root)[1] == sorted(expected)
    for key in sorted(expected):
        root = ns['erase'](root, key)
        check(root)
    assert root is None


def test_dijkstra_matches_floyd_warshall_on_small_nonnegative_graphs():
    ns = implementation('dijkstra')
    rng = random.Random(9)
    for n in range(1, 12):
        graph = [[] for _ in range(n)]
        oracle = [[float('inf')] * n for _ in range(n)]
        for u in range(n):
            oracle[u][u] = 0
            for v in range(n):
                if rng.random() < .25:
                    weight = rng.randrange(8)
                    graph[u].append((v, weight))
                    oracle[u][v] = min(oracle[u][v], weight)
        for k in range(n):
            for u in range(n):
                for v in range(n):
                    oracle[u][v] = min(oracle[u][v], oracle[u][k]+oracle[k][v])
        for source in range(n):
            distance, parent = ns['dijkstra'](graph, source)
            assert distance == oracle[source]
            for target in range(n):
                if target == source or distance[target] == float('inf'):
                    continue
                seen, cur = set(), target
                while cur != source:
                    assert cur not in seen
                    seen.add(cur)
                    predecessor = parent[cur]
                    assert predecessor is not None
                    assert any(v == cur and distance[predecessor]+w == distance[cur]
                               for v, w in graph[predecessor])
                    cur = predecessor
    with pytest.raises(ValueError):
        ns['dijkstra']([[(1, -1)], []], 0)


def test_knapsack_matches_exhaustive_subsets_and_reconstructs_once():
    ns = implementation('knapsack')
    rng = random.Random(99)
    for n in range(9):
        items = [(rng.randrange(1, 8), rng.randrange(15)) for _ in range(n)]
        for capacity in range(16):
            oracle = max(sum(items[i][1] for i in range(n) if mask >> i & 1)
                         for mask in range(1 << n)
                         if sum(items[i][0] for i in range(n) if mask >> i & 1) <= capacity)
            value, chosen = ns['knapsack'](items, capacity)
            assert value == oracle == ns['knapsack_value'](items, capacity)
            assert len(chosen) == len(set(chosen))
            assert sum(items[i][0] for i in chosen) <= capacity
            assert sum(items[i][1] for i in chosen) == value


@pytest.mark.parametrize('name', ['binary-search', 'avl-tree', 'dijkstra', 'knapsack'])
def test_javascript_examples_and_reference_problem_checks(name, tmp_path):
    if not shutil.which('node'):
        pytest.skip('node is unavailable')
    data = lesson(name)
    code = "function __check(name,actual,expected){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(name+' failed');}\n" + data['implementations']['javascript']
    # The AVL/Dijkstra exercises intentionally test component skills rather than
    # asking learners to paste the full reference solution.
    extras = {
        'avl-tree': 'function isBalanced(n){function h(n){if(!n)return 0;const a=h(n.left),b=h(n.right);return a<0||b<0||Math.abs(a-b)>1?-1:1+Math.max(a,b);}return h(n)>=0;}',
        'dijkstra': 'function relax(d,u,v,w){if(d[u]+w<d[v]){d[v]=d[u]+w;return true;}return false;}',
    }
    code += '\n' + extras.get(name, '') + '\n' + data['problems'][0]['tests']['javascript']
    path = tmp_path / 'example.js'
    path.write_text(code)
    subprocess.run(['node', str(path)], check=True, capture_output=True, text=True, timeout=10)


@pytest.mark.parametrize('name', ['binary-search', 'avl-tree', 'dijkstra', 'knapsack'])
@pytest.mark.parametrize('language', ['cpp', 'java', 'typescript'])
def test_compiled_reference_implementations(name, language, tmp_path):
    code = lesson(name)['implementations'][language]
    if language == 'cpp':
        if not shutil.which('g++'):
            pytest.skip('g++ unavailable')
        source = tmp_path / 'lesson.cpp'
        source.write_text(code)
        subprocess.run(['g++', '-std=c++17', '-Wall', str(source), '-o', str(tmp_path/'program')], check=True, capture_output=True, timeout=30)
        subprocess.run([str(tmp_path/'program')], check=True, capture_output=True, timeout=5)
    elif language == 'java':
        if not shutil.which('javac'):
            pytest.skip('javac unavailable')
        import re
        class_name = re.search(r'\bclass\s+(\w+)', code).group(1)
        source = tmp_path / (class_name + '.java')
        source.write_text(code)
        subprocess.run(['javac', str(source)], check=True, capture_output=True, timeout=30)
        subprocess.run(['java', '-cp', str(tmp_path), class_name], check=True, capture_output=True, timeout=10)
    else:
        if not shutil.which('tsc'):
            pytest.skip('TypeScript compiler unavailable')
        source = tmp_path / 'lesson.ts'
        source.write_text(code)
        subprocess.run(['tsc', '--target', 'es2020', '--skipLibCheck', '--outDir', str(tmp_path), str(source)], check=True, capture_output=True, timeout=30)
        subprocess.run(['node', str(tmp_path/'lesson.js')], check=True, capture_output=True, timeout=10)


@pytest.mark.parametrize('name', ['binary-search', 'avl-tree', 'dijkstra', 'knapsack'])
def test_cpp_exercise_harness_uses_existing_runner_protocol(name):
    import app
    if not app.CPP_COMPILER:
        pytest.skip('C++ compiler unavailable')
    problem = lesson(name)['problems'][0]
    sources = {
        'binary-search': lesson('binary-search')['implementations']['cpp'].split('int main()')[0],
        'avl-tree': 'struct Node {Node* left=nullptr;Node* right=nullptr;}; int height(Node*n){if(!n)return 0;int a=height(n->left),b=height(n->right);return a<0||b<0||abs(a-b)>1?-1:1+max(a,b);} bool is_balanced(Node*n){return height(n)>=0;}',
        'dijkstra': 'bool relax(vector<long long>&d,int u,int v,long long w){if(d[u]+w<d[v]){d[v]=d[u]+w;return true;}return false;}',
        'knapsack': 'int knapsack_value(const vector<pair<int,int>>&items,int capacity){vector<int>d(capacity+1);for(auto [w,v]:items)for(int c=capacity;c>=w;c--)d[c]=max(d[c],d[c-w]+v);return d[capacity];}',
    }
    for source, expected_pass in [(sources[name], True), (problem['starter']['cpp'], False)]:
        result = app._compile_and_run_cpp(source, problem['tests']['cpp'])
        assert not result.get('error'), result
        assert len(result['results']) >= 3
        assert all(check['pass'] for check in result['results']) is expected_pass


@pytest.mark.parametrize('name', ['binary-search', 'avl-tree', 'dijkstra', 'knapsack'])
def test_python_exercise_harness_emits_real_checks(name):
    problem = lesson(name)['problems'][0]
    ns = implementation(name)
    if name == 'avl-tree':
        exec('def is_balanced(n):\n    def height(n):\n        if n is None: return 0\n        a,b=height(n.left),height(n.right)\n        return -1 if a<0 or b<0 or abs(a-b)>1 else 1+max(a,b)\n    return height(n)>=0', ns)
    if name == 'dijkstra':
        exec('def relax(d,u,v,w):\n    if d[u]+w<d[v]:\n        d[v]=d[u]+w\n        return True\n    return False', ns)
    for source, expected_pass in [(None, True), (problem['starter']['python'], False)]:
        checks = []
        env = dict(ns) if source is None else {}
        env['__check'] = lambda title, actual, expected: checks.append(actual == expected)
        if source is not None:
            exec(source, env)
        exec(problem['tests']['python'], env)
        assert len(checks) >= 3
        assert all(checks) is expected_pass
