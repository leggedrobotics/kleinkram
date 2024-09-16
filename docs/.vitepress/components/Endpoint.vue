<template>
    <div class="endpoint">
        <h3>{{ endpoint }}</h3>
        <p><strong>Method:</strong> {{ getHttpMethod(spec) }}</p>
        <p>
            <strong>Description:</strong>
            {{
                spec[getHttpMethod(spec)].description ||
                'No description available'
            }}
        </p>

        <div
            v-if="
                spec[getHttpMethod(spec)].parameters &&
                spec[getHttpMethod(spec)].parameters.length
            "
        >
            <h4>Parameters</h4>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="parameter in spec[getHttpMethod(spec)]
                            .parameters"
                        :key="parameter.name"
                    >
                        <td>{{ parameter.name }}</td>
                        <td>{{ parameter.in }}</td>
                        <td>{{ parameter.schema?.type || 'N/A' }}</td>
                        <td>
                            {{
                                parameter.description ||
                                'No description available'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="spec[getHttpMethod(spec)].responses">
            <h4>Responses</h4>
            <table>
                <thead>
                    <tr>
                        <th>Status Code</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(response, code) in spec[getHttpMethod(spec)]
                            .responses"
                        :key="code"
                    >
                        <td>{{ code }}</td>
                        <td>
                            {{
                                response.description ||
                                'No description available'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    endpoint: string;
    spec: any;
}>();

// Helper function to get the first HTTP method available in the spec
function getHttpMethod(spec: any) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    return methods.find((method) => spec[method]);
}
console.log(JSON.stringify(props.spec));
</script>

<style scoped>
.endpoint {
    border: 1px solid #ddd;
    padding: 16px;
    margin-bottom: 16px;
    background-color: #f9f9f9;
    border-radius: 8px;
}

h3 {
    color: #333;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}

th,
td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

th {
    background-color: #f4f4f4;
}

p {
    margin: 4px 0;
}

h4 {
    margin-top: 16px;
    color: #666;
}
</style>
